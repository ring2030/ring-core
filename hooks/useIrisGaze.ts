"use client";

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
}

// MediaPipe FaceMesh ランドマーク インデックス（正規化座標 0〜1）
const LM = {
  NOSE_TIP: 1,
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
  FACE_LEFT: 234,
  FACE_RIGHT: 454,
} as const;

interface FaceMeshResult {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
}
interface FaceMeshInstance {
  setOptions(opts: Record<string, unknown>): void;
  onResults(callback: (results: FaceMeshResult) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): void;
}
interface FaceMeshCtor {
  new (config: { locateFile: (f: string) => string }): FaceMeshInstance;
}

/**
 * public/@mediapipe/face_mesh/face_mesh.js をロードし window.FaceMesh を確立する。
 * 二重ロードを防ぐために data 属性でガードする。
 */
function loadFaceMeshScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-mp-fm]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.setAttribute("data-mp-fm", "1");
    s.src = "/@mediapipe/face_mesh/face_mesh.js";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("face_mesh.js の読み込みに失敗しました。public/@mediapipe/face_mesh/ を確認してください。"));
    document.head.appendChild(s);
  });
}

function getFaceMeshCtor(): FaceMeshCtor | null {
  return (window as unknown as { FaceMesh?: FaceMeshCtor }).FaceMesh ?? null;
}

/**
 * MediaPipe 正規化座標（0〜1）で視線方向を推定。
 * selfieMode:true のため x は鏡像（右を見る → x が大きい）。
 * 478点あれば虹彩ベース、468点では頭部向きベース。
 */
function calcGazeX(kp: Array<{ x: number; y: number }>): number | null {
  if (kp.length < 468) return null;
  const faceW = Math.abs(kp[LM.FACE_RIGHT].x - kp[LM.FACE_LEFT].x);
  if (faceW < 0.02) return null;

  if (kp.length >= 478) {
    // 虹彩ベース（高精度）
    const avgIrisX = (kp[LM.LEFT_IRIS].x + kp[LM.RIGHT_IRIS].x) / 2;
    const offset = (avgIrisX - kp[LM.NOSE_TIP].x) / (faceW * 0.25);
    return Math.max(-1, Math.min(1, offset));
  }
  // 頭部向きベース（フォールバック）
  const faceCenterX = (kp[LM.FACE_LEFT].x + kp[LM.FACE_RIGHT].x) / 2;
  const offset = (kp[LM.NOSE_TIP].x - faceCenterX) / (faceW * 0.35);
  return Math.max(-1, Math.min(1, offset));
}

function zoneFromGaze(gazeX: number | null, threshold: number): GazeZone {
  if (gazeX === null) return "center";
  if (gazeX < -threshold) return "left";
  if (gazeX > threshold) return "right";
  return "center";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // video→canvas変換用
  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  // send() が pending かどうか（多重呼び出し防止）
  const sendingRef = useRef(false);
  const [frameCount, setFrameCount] = useState(0);
  const [resultCount, setResultCount] = useState(0);
  const [kpLen, setKpLen] = useState(-1); // MediaPipe が返すランドマーク数（-1=顔なし）
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0, paused: true, brightness: -1 }); // 診断用

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
    try { faceMeshRef.current?.close(); } catch { /* ignore */ }
    faceMeshRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    canvasRef.current = null;
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
        // 1. face_mesh.js をロード → window.FaceMesh を確立
        await loadFaceMeshScript();
        if (localCancel || cancelledRef.current) return;

        const FaceMeshCtor = getFaceMeshCtor();
        if (!FaceMeshCtor) {
          throw new Error("window.FaceMesh が見つかりません。ページを再読み込みしてください。");
        }

        // 2. FaceMesh インスタンスを作成
        const fm = new FaceMeshCtor({
          locateFile: (file: string) => `/@mediapipe/face_mesh/${file}`,
        });

        fm.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,     // false = 468点モデル（軽量・高速）
          selfieMode: true,           // カメラ映像は通常ミラー済み → true が自然
          minDetectionConfidence: 0.2,
          minTrackingConfidence: 0.2,
        });

        faceMeshRef.current = fm;

        // 3. onResults コールバックを先に登録
        fm.onResults((results: FaceMeshResult) => {
          if (localCancel || cancelledRef.current) return;
          setResultCount((n) => n + 1);

          const now = performance.now();
          const last = lastTsRef.current ?? now;
          const dt = Math.min(Math.max(now - last, 0), 100);
          lastTsRef.current = now;

          const kp = results.multiFaceLandmarks?.[0];
          const kpCount = kp ? kp.length : -1;
          setKpLen(kpCount);
          const gx = kp ? calcGazeX(kp) : null;
          // faceDetected = MediaPipe が顔を認識したかどうか（gaze計算の成否とは独立）
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
        });

        // 4. カメラを開く
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          fm.close();
          return;
        }
        streamRef.current = stream;

        // 5. videoRef が DOM に現れるまで待つ（最大 5 秒）
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
          fm.close();
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
        await video.play().catch(() => {/* autoplay 制限は無視 */});

        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          fm.close();
          return;
        }

        setState((s) => ({ ...s, isReady: true, error: null }));

        // 6. RAFループ：send() の完了を待たずに毎フレームスケジュールし、
        //    send() が pending の間はスキップ（多重送信・ループ死を両方防ぐ）
        // canvas を一度だけ作成（crossOriginIsolated環境でのWebGL制限を回避）
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }

        let diagCounter = 0;
        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;
          rafRef.current = requestAnimationFrame(runLoop); // 次フレームを先に予約

          const vid = videoRef.current;
          const mesh = faceMeshRef.current;
          if (!vid || !mesh || vid.readyState < 2) return;
          if (sendingRef.current) return; // 前フレーム処理中 → スキップ
          if (vid.videoWidth === 0) return;

          // 診断情報を 30 フレームごとに更新
          if (diagCounter++ % 30 === 0) {
            // canvasに一時描画して明度チェック
            let brightness = -1;
            try {
              const cvs = canvasRef.current!;
              if (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight) {
                cvs.width = vid.videoWidth;
                cvs.height = vid.videoHeight;
              }
              const ctx2 = cvs.getContext("2d");
              if (ctx2) {
                ctx2.drawImage(vid, 0, 0);
                const px = ctx2.getImageData(Math.floor(cvs.width / 2) - 2, Math.floor(cvs.height / 2) - 2, 4, 4);
                brightness = Math.round(
                  Array.from(px.data).reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0) / (4 * 4 * 3)
                );
              }
            } catch { /* ignore */ }
            setVideoSize({ w: vid.videoWidth, h: vid.videoHeight, paused: vid.paused, brightness });
            if (vid.paused) { vid.play().catch(() => {}); }
          }

          // COOP/COEP除去済みなのでビデオ要素を直接送信
          sendingRef.current = true;
          setFrameCount((n) => n + 1);
          mesh.send({ image: vid })
            .catch(() => {/* 個別フレームのエラーは無視 */})
            .finally(() => { sendingRef.current = false; });
        };
        runLoop();

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "初期化に失敗しました";
        if (!localCancel && !cancelledRef.current) {
          setState((s) => ({ ...s, error: msg, isReady: false, faceDetected: false }));
        }
      }
    }

    void boot();

    return () => {
      localCancel = true;
      cancelledRef.current = true;
      stopAll();
    };
  }, [enabled, restartKey, stopAll, bumpActivity]);

  return { videoRef, frameCount, resultCount, kpLen, videoSize, ...state };
}
