"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GAZE_THROTTLE_MS } from "@/lib/constants";

export type GazeZone = "left" | "right" | "center" | "none";

export interface IrisGazeState {
  zone: GazeZone;
  leftProgress: number;
  rightProgress: number;
  gazeX: number;
  faceDetected: boolean;
  isReady: boolean;
  error: string | null;
}

export interface UseIrisGazeOptions {
  dwellMs?: number;
  threshold?: number;
  onLeftSelect?: () => void;
  onRightSelect?: () => void;
  onActivity?: () => void;
  enabled?: boolean;
  restartKey?: number;
  /** 提供するとフレーム＋検出結果をこの canvas に描画する（開発用デバッグ） */
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** 使用するカメラの deviceId（未指定 = ブラウザのデフォルト） */
  cameraDeviceId?: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

type FaceKp = { x: number; y: number; name?: string };
type FaceBox = { xMin: number; yMin: number; width: number; height: number };
type DetectedFace = { box: FaceBox; keypoints: FaceKp[] };

/**
 * face-detection の結果からgaze X を算出。
 * flipHorizontal:true で取得 → 右を見ると noseTip.x が大きくなる（ユーザー視点）。
 */
function calcGazeX(face: DetectedFace): number | null {
  const noseTip = face.keypoints.find((k) => k.name === "noseTip") ?? face.keypoints[2];
  if (!noseTip) return null;
  const faceCenter = face.box.xMin + face.box.width / 2;
  if (face.box.width < 20) return null; // 顔が小さすぎる（遠すぎ）
  const offset = (noseTip.x - faceCenter) / (face.box.width * 0.35);
  return Math.max(-1, Math.min(1, offset));
}

function zoneFromGaze(gazeX: number | null, threshold: number): GazeZone {
  if (gazeX === null) return "center";
  if (gazeX < -threshold) return "left";
  if (gazeX > threshold) return "right";
  return "center";
}

/** デバッグキャンバスに映像＋検出結果を描画（左右反転でセルフィー表示） */
function drawDebug(
  dbgCtx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  face: DetectedFace | null,
  videoWidth: number,
) {
  // セルフィー表示（左右反転）
  dbgCtx.save();
  dbgCtx.translate(videoWidth, 0);
  dbgCtx.scale(-1, 1);
  dbgCtx.drawImage(src, 0, 0);
  dbgCtx.restore();

  if (!face) return;

  // flipHorizontal:true で返った座標は「反転後の空間」に一致している
  // → ミラー描画後の canvas に直接プロットすれば OK（mx() 変換不要）

  // バウンディングボックス
  dbgCtx.strokeStyle = "#00ff00";
  dbgCtx.lineWidth = 2;
  dbgCtx.strokeRect(face.box.xMin, face.box.yMin, face.box.width, face.box.height);

  // キーポイント
  for (const kp of face.keypoints) {
    dbgCtx.fillStyle = kp.name === "noseTip" ? "#ff3333" : "#ffff00";
    dbgCtx.beginPath();
    dbgCtx.arc(kp.x, kp.y, kp.name === "noseTip" ? 6 : 3, 0, Math.PI * 2);
    dbgCtx.fill();
  }
}

const FACE_LOST_RESET_MS = 300;

export function useIrisGaze(options: UseIrisGazeOptions) {
  const {
    dwellMs = 3500,
    threshold = 0.12,
    onLeftSelect,
    onRightSelect,
    onActivity,
    enabled = true,
    restartKey = 0,
    debugCanvasRef,
    cameraDeviceId,
  } = options;

  const dwellMsRef = useRef(dwellMs);
  dwellMsRef.current = dwellMs;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<IrisGazeState>({
    zone: "none",
    leftProgress: 0,
    rightProgress: 0,
    gazeX: 0,
    faceDetected: false,
    isReady: false,
    error: null,
  });

  const dLeftRef = useRef(0);
  const dRightRef = useRef(0);
  const faceLostAtRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const sendingRef = useRef(false);

  const [frameCount, setFrameCount] = useState(0);
  const [resultCount, setResultCount] = useState(0);
  const [kpLen, setKpLen] = useState(-1);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0, paused: true, brightness: -1 });
  const [initStatus, setInitStatus] = useState("");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);

  const onLeftRef = useRef(onLeftSelect);
  const onRightRef = useRef(onRightSelect);
  const onActivityRef = useRef(onActivity);
  onLeftRef.current = onLeftSelect;
  onRightRef.current = onRightSelect;
  onActivityRef.current = onActivity;

  const bumpActivity = useCallback(() => {
    const now = performance.now();
    if (now - lastActivityAtRef.current < GAZE_THROTTLE_MS) return;
    lastActivityAtRef.current = now;
    onActivityRef.current?.();
  }, []);

  const stopAll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try { detectorRef.current?.dispose(); } catch { /* ignore */ }
    detectorRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    modelCanvasRef.current = null;
    sendingRef.current = false;
    lastTsRef.current = null;
    faceLostAtRef.current = null;
    dLeftRef.current = 0;
    dRightRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      stopAll();
      setInitStatus("");
      setState((s) => ({
        ...s, zone: "none", leftProgress: 0, rightProgress: 0,
        gazeX: 0, faceDetected: false, isReady: false,
      }));
      return;
    }

    cancelledRef.current = false;
    let localCancel = false;

    async function boot() {
      setState((s) => ({ ...s, error: null, isReady: false }));

      try {
        // ── Step 1: TF.js WebGL バックエンド初期化 ──
        setInitStatus("TF.js WebGL 初期化中…");
        const tf = await import("@tensorflow/tfjs-core");
        await import("@tensorflow/tfjs-backend-webgl");
        try {
          await tf.setBackend("webgl");
        } catch {
          // WebGL が使えない場合は CPU にフォールバック
          await tf.setBackend("cpu");
        }
        await tf.ready();
        if (localCancel || cancelledRef.current) return;

        // ── Step 2: 顔検出モデルをロード ──
        setInitStatus("顔検出モデル読み込み中… (初回のみ時間がかかります)");
        const faceDetection = await import("@tensorflow-models/face-detection");
        const detector = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: "tfjs" as const,
            modelType: "short" as const, // 2m以内・高速
            maxFaces: 1,
          },
        );
        if (localCancel || cancelledRef.current) {
          detector.dispose();
          return;
        }
        detectorRef.current = detector;
        setInitStatus("モデル準備完了。カメラ起動中…");

        // ── Step 3: カメラ一覧を取得してから開く ──
        // 一度 permissions を取得しないとラベルが空になるため、先に getUserMedia する
        const videoConstraints: MediaTrackConstraints = cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

        // 接続済みカメラ一覧を取得（パーミッション取得後でないとラベルが空）
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices
            .filter((d) => d.kind === "videoinput")
            .map((d) => ({ deviceId: d.deviceId, label: d.label || `カメラ ${d.deviceId.slice(0, 8)}` }));
          setCameras(videoDevices);
        } catch { /* ignore */ }
        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          return;
        }
        streamRef.current = stream;

        // ── Step 4: videoRef が DOM に現れるまで待つ ──
        const video = await (async () => {
          const t0 = performance.now();
          while (performance.now() - t0 < 5000) {
            if (localCancel || cancelledRef.current) return null;
            if (videoRef.current) return videoRef.current;
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
          }
          return videoRef.current;
        })();

        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          if (!localCancel && !cancelledRef.current) {
            setState((s) => ({
              ...s,
              error: "ビデオ要素が未準備です。ページを再読み込みしてください。",
              isReady: false,
            }));
          }
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          return;
        }

        setInitStatus("");
        setState((s) => ({ ...s, isReady: true, error: null }));

        if (!modelCanvasRef.current) {
          modelCanvasRef.current = document.createElement("canvas");
        }

        let diagCounter = 0;

        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;
          rafRef.current = requestAnimationFrame(runLoop);

          const vid = videoRef.current;
          const det = detectorRef.current;
          if (!vid || !det || vid.readyState < 2) return;
          if (sendingRef.current) return;
          if (vid.videoWidth === 0) return;

          // ── モデル用キャンバスにビデオを描画 ──
          const cvs = modelCanvasRef.current!;
          if (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight) {
            cvs.width = vid.videoWidth;
            cvs.height = vid.videoHeight;
          }
          const ctx = cvs.getContext("2d");
          if (!ctx) return;
          try { ctx.drawImage(vid, 0, 0); } catch { return; }

          // ── 診断情報を 30 フレームごとに更新 ──
          if (diagCounter++ % 30 === 0) {
            let brightness = -1;
            try {
              const sx = Math.floor(cvs.width / 2) - 16;
              const sy = Math.floor(cvs.height / 2) - 16;
              const px = ctx.getImageData(sx, sy, 32, 32);
              brightness = Math.round(
                Array.from(px.data).reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0) / (32 * 32 * 3),
              );
            } catch { /* ignore */ }
            setVideoSize({ w: vid.videoWidth, h: vid.videoHeight, paused: vid.paused, brightness });
            if (vid.paused) { vid.play().catch(() => {}); }
          }

          const videoWidth = vid.videoWidth;
          sendingRef.current = true;
          setFrameCount((n) => n + 1);

          // ── 顔検出（flipHorizontal:true = 右を見ると gazeX > 0） ──
          (det.estimateFaces(cvs, { flipHorizontal: true }) as Promise<DetectedFace[]>)
            .then((faces) => {
              if (localCancel || cancelledRef.current) return;
              setResultCount((n) => n + 1);

              const now = performance.now();
              const last = lastTsRef.current ?? now;
              const dt = Math.min(Math.max(now - last, 0), 100);
              lastTsRef.current = now;

              const face = faces[0] ?? null;
              const kpCount = face ? face.keypoints.length : -1;
              setKpLen(kpCount);

              // ── デバッグキャンバスに描画 ──
              const dbgCvs = debugCanvasRef?.current;
              if (dbgCvs) {
                if (dbgCvs.width !== videoWidth || dbgCvs.height !== vid.videoHeight) {
                  dbgCvs.width = videoWidth;
                  dbgCvs.height = vid.videoHeight;
                }
                const dbgCtx = dbgCvs.getContext("2d");
                if (dbgCtx) {
                  drawDebug(dbgCtx, cvs, face, videoWidth);
                }
              }

              const gx = face ? calcGazeX(face) : null;
              const faceMeshDetected = kpCount > 0;
              const valid = gx !== null;

              let zone: GazeZone = "none";
              let gazeXVal = 0;
              let faceDetected = false;

              if (!faceMeshDetected) {
                if (faceLostAtRef.current === null) faceLostAtRef.current = now;
                const lostMs = now - faceLostAtRef.current;
                if (lostMs < FACE_LOST_RESET_MS) zone = "center";
                else { dLeftRef.current = 0; dRightRef.current = 0; }
              } else {
                faceLostAtRef.current = null;
                faceDetected = true;
                if (valid) {
                  gazeXVal = gx!;
                  zone = zoneFromGaze(gx, thresholdRef.current);
                  bumpActivity();
                } else {
                  zone = "center";
                }
              }

              const d = dwellMsRef.current;
              if (zone === "left") {
                dLeftRef.current = Math.min(d, dLeftRef.current + dt);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 2);
              } else if (zone === "right") {
                dRightRef.current = Math.min(d, dRightRef.current + dt);
                dLeftRef.current = Math.max(0, dLeftRef.current - dt * 2);
              } else if (zone === "center") {
                dLeftRef.current = Math.max(0, dLeftRef.current - dt * 0.6);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 0.6);
              }

              dLeftRef.current = Math.min(d, Math.max(0, dLeftRef.current));
              dRightRef.current = Math.min(d, Math.max(0, dRightRef.current));

              if (dLeftRef.current >= d) {
                onLeftRef.current?.();
                dLeftRef.current = 0;
                dRightRef.current = 0;
              } else if (dRightRef.current >= d) {
                onRightRef.current?.();
                dLeftRef.current = 0;
                dRightRef.current = 0;
              }

              setState({
                zone,
                leftProgress: d > 0 ? dLeftRef.current / d : 0,
                rightProgress: d > 0 ? dRightRef.current / d : 0,
                gazeX: gazeXVal,
                faceDetected,
                isReady: true,
                error: null,
              });
            })
            .catch((e: unknown) => {
              // エラーを飲み込まずに state に反映（何が起きているか可視化）
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[useIrisGaze] estimateFaces error:", msg);
              setState((s) => ({ ...s, error: `検出エラー: ${msg.slice(0, 120)}` }));
            })
            .finally(() => { sendingRef.current = false; });
        };

        runLoop();

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "初期化に失敗しました";
        console.error("[useIrisGaze] boot error:", msg);
        if (!localCancel && !cancelledRef.current) {
          setState((s) => ({ ...s, error: msg, isReady: false, faceDetected: false }));
          setInitStatus("");
        }
      }
    }

    void boot();

    return () => {
      localCancel = true;
      cancelledRef.current = true;
      stopAll();
      setInitStatus("");
    };
  }, [enabled, restartKey, stopAll, bumpActivity, debugCanvasRef, cameraDeviceId]);

  return { videoRef, frameCount, resultCount, kpLen, videoSize, initStatus, cameras, ...state };
}
