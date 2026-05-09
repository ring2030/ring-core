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
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  cameraDeviceId?: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/** Normalized MediaPipe FaceDetection result */
type MPDetection = {
  boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
  landmarks: { x: number; y: number }[];
};

/** Load @mediapipe/face_detection script from self-hosted WASM files */
function loadFaceDetectionScript(): Promise<void> {
  if ((window as unknown as Record<string, unknown>)["FaceDetection"]) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="face_detection.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("face_detection.js load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = "/@mediapipe/face_detection/face_detection.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load /@mediapipe/face_detection/face_detection.js"));
    document.head.appendChild(script);
  });
}

/**
 * Compute gaze X from MediaPipe face detection result.
 * selfieMode:true → looking right gives larger noseTip.x (user perspective).
 * All coordinates are normalized (0–1).
 */
function calcGazeX(det: MPDetection): number | null {
  const noseTip = det.landmarks[2]; // index 2 = noseTip
  if (!noseTip) return null;
  const bb = det.boundingBox;
  if (bb.width < 0.01) return null; // face too small
  const offset = (noseTip.x - bb.xCenter) / (bb.width * 0.35);
  return Math.max(-1, Math.min(1, offset));
}

function zoneFromGaze(gazeX: number | null, threshold: number): GazeZone {
  if (gazeX === null) return "center";
  if (gazeX < -threshold) return "left";
  if (gazeX > threshold) return "right";
  return "center";
}

function drawDebug(
  dbgCtx: CanvasRenderingContext2D,
  src: HTMLVideoElement,
  det: MPDetection | null,
) {
  const W = src.videoWidth;
  const H = src.videoHeight;
  dbgCtx.save();
  dbgCtx.translate(W, 0);
  dbgCtx.scale(-1, 1);
  dbgCtx.drawImage(src, 0, 0);
  dbgCtx.restore();
  if (!det) return;
  const bb = det.boundingBox;
  const xMin = (bb.xCenter - bb.width / 2) * W;
  const yMin = (bb.yCenter - bb.height / 2) * H;
  dbgCtx.strokeStyle = "#00ff00";
  dbgCtx.lineWidth = 2;
  dbgCtx.strokeRect(xMin, yMin, bb.width * W, bb.height * H);
  det.landmarks.forEach((kp, i) => {
    const isNose = i === 2;
    dbgCtx.fillStyle = isNose ? "#ff3333" : "#ffff00";
    dbgCtx.beginPath();
    dbgCtx.arc(kp.x * W, kp.y * H, isNose ? 6 : 3, 0, Math.PI * 2);
    dbgCtx.fill();
  });
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
    try { detectorRef.current?.close(); } catch { /* ignore */ }
    detectorRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
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
        // Step 1: Load MediaPipe face_detection script from self-hosted WASM files
        setInitStatus("Loading face detection model…");
        await loadFaceDetectionScript();
        if (localCancel || cancelledRef.current) return;

        // Step 2: Create detector using window.FaceDetection (set by the script)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FDClass = (window as unknown as { FaceDetection: new(cfg: unknown) => any }).FaceDetection;
        if (!FDClass) throw new Error("FaceDetection class not found after script load");

        const detector = new FDClass({
          locateFile: (file: string) => `/@mediapipe/face_detection/${file}`,
        });

        // Store latest results from callback
        let latestDetection: MPDetection | null = null;

        detector.setOptions({
          model: "short",
          selfieMode: true,
          minDetectionConfidence: 0.5,
        });

        detector.onResults((results: { detections: MPDetection[] }) => {
          latestDetection = results.detections?.[0] ?? null;
        });

        setInitStatus("Initializing model…");
        await detector.initialize();
        if (localCancel || cancelledRef.current) {
          detector.close();
          return;
        }
        detectorRef.current = detector;

        // Step 3: Open camera
        setInitStatus("Starting camera…");
        const videoConstraints: MediaTrackConstraints = cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCameras(
            devices
              .filter((d) => d.kind === "videoinput")
              .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` })),
          );
        } catch { /* ignore */ }

        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.close();
          return;
        }
        streamRef.current = stream;

        // Step 4: Wait for videoRef in DOM (up to 5s)
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
          detector.close();
          if (!localCancel && !cancelledRef.current) {
            setState((s) => ({ ...s, error: "Video element not ready. Reload the page.", isReady: false }));
          }
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.close();
          return;
        }

        setInitStatus("");
        setState((s) => ({ ...s, isReady: true, error: null }));

        let diagCounter = 0;

        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;
          rafRef.current = requestAnimationFrame(runLoop);

          const vid = videoRef.current;
          const det = detectorRef.current;
          if (!vid || !det || vid.readyState < 2) return;
          if (sendingRef.current) return;
          if (vid.videoWidth === 0) return;

          if (diagCounter++ % 30 === 0) {
            setVideoSize({ w: vid.videoWidth, h: vid.videoHeight, paused: vid.paused, brightness: -1 });
            if (vid.paused) { vid.play().catch(() => {}); }
          }

          sendingRef.current = true;
          setFrameCount((n) => n + 1);

          (det.send({ image: vid }) as Promise<void>)
            .then(() => {
              if (localCancel || cancelledRef.current) return;
              setResultCount((n) => n + 1);

              const now = performance.now();
              const last = lastTsRef.current ?? now;
              const dt = Math.min(Math.max(now - last, 0), 100);
              lastTsRef.current = now;

              const face = latestDetection;
              const kpCount = face ? face.landmarks.length : -1;
              setKpLen(kpCount);

              const dbgCvs = debugCanvasRef?.current;
              if (dbgCvs && vid) {
                if (dbgCvs.width !== vid.videoWidth || dbgCvs.height !== vid.videoHeight) {
                  dbgCvs.width = vid.videoWidth;
                  dbgCvs.height = vid.videoHeight;
                }
                const dbgCtx = dbgCvs.getContext("2d");
                if (dbgCtx) drawDebug(dbgCtx, vid, face);
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
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[useIrisGaze] send error:", msg);
              setState((s) => ({ ...s, error: `Detection error: ${msg.slice(0, 120)}` }));
            })
            .finally(() => { sendingRef.current = false; });
        };

        runLoop();

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Initialization failed";
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
