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
  /** Debug: draw detected landmarks on this canvas (development only) */
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Camera deviceId to use (undefined = browser default) */
  cameraDeviceId?: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

type FaceKp = { x: number; y: number; z?: number; name?: string };
type FaceBox = { xMin: number; yMin: number; width: number; height: number };
type DetectedFaceMesh = { box: FaceBox; keypoints: FaceKp[] };

/**
 * Iris-based gaze X using MediaPipe FaceMesh (refineLandmarks: true → 478 keypoints).
 *
 * Iris landmarks:
 *   Left iris rim:  468, 469, 470, 471
 *   Right iris rim: 472, 473, 474, 475
 *
 * Eye corner landmarks (after flipHorizontal: true — selfie / user perspective):
 *   Face "left" eye outer: 33  (user's left, lower x in flipped image)
 *   Face "left" eye inner: 133 (toward nose, higher x)
 *   Face "right" eye inner: 362 (toward nose, lower x)
 *   Face "right" eye outer: 263 (user's right, higher x)
 *
 * Returns -1 (looking left = Restroom) … +1 (looking right = Chat).
 */
function calcIrisGazeX(keypoints: FaceKp[]): number | null {
  if (keypoints.length < 476) return null;

  // Iris centers (centroid of 4 rim points each)
  const lIrisX =
    (keypoints[468].x + keypoints[469].x + keypoints[470].x + keypoints[471].x) / 4;
  const rIrisX =
    (keypoints[472].x + keypoints[473].x + keypoints[474].x + keypoints[475].x) / 4;

  // Eye horizontal extent
  const lLeft  = Math.min(keypoints[33].x,  keypoints[133].x);
  const lRight = Math.max(keypoints[33].x,  keypoints[133].x);
  const rLeft  = Math.min(keypoints[362].x, keypoints[263].x);
  const rRight = Math.max(keypoints[362].x, keypoints[263].x);

  const lWidth = lRight - lLeft;
  const rWidth = rRight - rLeft;

  const lOk = lWidth > 5;
  const rOk = rWidth > 5;
  if (!lOk && !rOk) return null;

  // Normalise iris within eye: 0 = leftmost, 1 = rightmost
  const norms: number[] = [];
  if (lOk) norms.push((lIrisX - lLeft) / lWidth);
  if (rOk) norms.push((rIrisX - rLeft) / rWidth);

  const avg = norms.reduce((a, b) => a + b, 0) / norms.length;
  // Centre at 0, scale ±0.5 → ±1
  const gazeX = (avg - 0.5) * 2;
  return Math.max(-1, Math.min(1, gazeX));
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
    debugCanvasRef,
    cameraDeviceId,
  } = options;

  const dwellMsRef    = useRef(dwellMs);
  dwellMsRef.current  = dwellMs;
  const thresholdRef  = useRef(threshold);
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

  const dLeftRef           = useRef(0);
  const dRightRef          = useRef(0);
  const faceLostAtRef      = useRef<number | null>(null);
  const lastActivityAtRef  = useRef(0);
  const lastTsRef          = useRef<number | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const modelCanvasRef     = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef        = useRef<any>(null);
  const rafRef             = useRef<number | null>(null);
  const cancelledRef       = useRef(false);
  const sendingRef         = useRef(false);

  const [frameCount,  setFrameCount]  = useState(0);
  const [resultCount, setResultCount] = useState(0);
  const [kpLen,       setKpLen]       = useState(-1);
  const [videoSize,   setVideoSize]   = useState({ w: 0, h: 0, paused: true, brightness: -1 });
  const [initStatus,  setInitStatus]  = useState("");
  const [cameras,     setCameras]     = useState<CameraDevice[]>([]);

  const onLeftRef     = useRef(onLeftSelect);
  const onRightRef    = useRef(onRightSelect);
  const onActivityRef = useRef(onActivity);
  onLeftRef.current     = onLeftSelect;
  onRightRef.current    = onRightSelect;
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
    streamRef.current    = null;
    modelCanvasRef.current = null;
    sendingRef.current   = false;
    lastTsRef.current    = null;
    faceLostAtRef.current = null;
    dLeftRef.current     = 0;
    dRightRef.current    = 0;
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
        // ── Step 1: Load MediaPipe FaceMesh detector (self-hosted WASM) ──
        setInitStatus("Loading face model…");
        const faceLandmarks = await import("@tensorflow-models/face-landmarks-detection");
        if (localCancel || cancelledRef.current) return;

        const detector = await faceLandmarks.createDetector(
          faceLandmarks.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "mediapipe" as const,
            // WASM files are self-hosted under public/@mediapipe/face_mesh/
            solutionPath: "/@mediapipe/face_mesh",
            refineLandmarks: true,  // enables iris landmarks 468-477
            maxFaces: 1,
          },
        );
        if (localCancel || cancelledRef.current) {
          detector.dispose();
          return;
        }
        detectorRef.current = detector;
        setInitStatus("Model ready. Starting camera…");

        // ── Step 2: Open camera ──
        const videoConstraints: MediaTrackConstraints = cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

        // Enumerate cameras (label available after getUserMedia)
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
          detector.dispose();
          return;
        }
        streamRef.current = stream;

        // ── Step 3: Wait for videoRef to appear in the DOM (up to 5s) ──
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
            setState((s) => ({ ...s, error: "Video element not ready. Reload the page.", isReady: false }));
          }
          return;
        }

        video.srcObject  = stream;
        video.muted      = true;
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

        // ── Step 4: Detection loop ──
        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;
          rafRef.current = requestAnimationFrame(runLoop);

          const vid = videoRef.current;
          const det = detectorRef.current;
          if (!vid || !det || vid.readyState < 2) return;
          if (sendingRef.current) return;
          if (vid.videoWidth === 0) return;

          // Snapshot video frame onto offscreen canvas
          const cvs = modelCanvasRef.current!;
          if (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight) {
            cvs.width  = vid.videoWidth;
            cvs.height = vid.videoHeight;
          }
          const ctx = cvs.getContext("2d");
          if (!ctx) return;
          try { ctx.drawImage(vid, 0, 0); } catch { return; }

          // Diagnostics every 30 frames
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

          sendingRef.current = true;
          setFrameCount((n) => n + 1);

          // Estimate face landmarks with iris (flipHorizontal: true = selfie / user perspective)
          (det.estimateFaces(cvs, { flipHorizontal: true }) as Promise<DetectedFaceMesh[]>)
            .then((faces) => {
              if (localCancel || cancelledRef.current) return;
              setResultCount((n) => n + 1);

              const now  = performance.now();
              const last = lastTsRef.current ?? now;
              const dt   = Math.min(Math.max(now - last, 0), 100);
              lastTsRef.current = now;

              const face    = faces[0] ?? null;
              const kpCount = face ? face.keypoints.length : -1;
              setKpLen(kpCount);

              // Optional debug overlay
              const dbgCvs = debugCanvasRef?.current;
              if (dbgCvs && face) {
                if (dbgCvs.width !== cvs.width || dbgCvs.height !== cvs.height) {
                  dbgCvs.width  = cvs.width;
                  dbgCvs.height = cvs.height;
                }
                const dbgCtx = dbgCvs.getContext("2d");
                if (dbgCtx) {
                  // Selfie-mirror display
                  dbgCtx.save();
                  dbgCtx.translate(cvs.width, 0);
                  dbgCtx.scale(-1, 1);
                  dbgCtx.drawImage(cvs, 0, 0);
                  dbgCtx.restore();
                  // Iris points
                  for (let i = 468; i < 476 && i < face.keypoints.length; i++) {
                    const kp = face.keypoints[i];
                    dbgCtx.fillStyle = i < 472 ? "#00ffff" : "#ff00ff";
                    dbgCtx.beginPath();
                    dbgCtx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
                    dbgCtx.fill();
                  }
                }
              }

              const gx             = face ? calcIrisGazeX(face.keypoints) : null;
              const faceMeshDetected = kpCount > 0;
              const valid            = gx !== null;

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
                dLeftRef.current  = Math.min(d, dLeftRef.current + dt);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 2);
              } else if (zone === "right") {
                dRightRef.current = Math.min(d, dRightRef.current + dt);
                dLeftRef.current  = Math.max(0, dLeftRef.current - dt * 2);
              } else if (zone === "center") {
                dLeftRef.current  = Math.max(0, dLeftRef.current  - dt * 0.6);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 0.6);
              }

              dLeftRef.current  = Math.min(d, Math.max(0, dLeftRef.current));
              dRightRef.current = Math.min(d, Math.max(0, dRightRef.current));

              if (dLeftRef.current >= d) {
                onLeftRef.current?.();
                dLeftRef.current  = 0;
                dRightRef.current = 0;
              } else if (dRightRef.current >= d) {
                onRightRef.current?.();
                dLeftRef.current  = 0;
                dRightRef.current = 0;
              }

              setState({
                zone,
                leftProgress:  d > 0 ? dLeftRef.current  / d : 0,
                rightProgress: d > 0 ? dRightRef.current / d : 0,
                gazeX: gazeXVal,
                faceDetected,
                isReady: true,
                error: null,
              });
            })
            .catch((e: unknown) => {
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[useIrisGaze] estimateFaces error:", msg);
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
