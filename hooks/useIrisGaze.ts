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
  /** Debug canvas — draw detected landmarks (dev only) */
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Camera deviceId (undefined = browser default) */
  cameraDeviceId?: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

// MediaPipe FaceMesh landmark indices (normalised 0–1 coords)
const LM = {
  NOSE_TIP:   1,
  LEFT_IRIS:  468,
  RIGHT_IRIS: 473,
  FACE_LEFT:  234,
  FACE_RIGHT: 454,
} as const;

interface FaceMeshResult {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
}
interface FaceMeshInstance {
  setOptions(opts: Record<string, unknown>): void;
  onResults(cb: (r: FaceMeshResult) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): void;
}
interface FaceMeshCtor {
  new (config: { locateFile: (f: string) => string }): FaceMeshInstance;
}

/**
 * Load public/@mediapipe/face_mesh/face_mesh.js once, establishing window.FaceMesh.
 * A data attribute guards against double-loading.
 */
function loadFaceMeshScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector("script[data-mp-fm]")) { resolve(); return; }
    const s = document.createElement("script");
    s.setAttribute("data-mp-fm", "1");
    s.src = "/@mediapipe/face_mesh/face_mesh.js";
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(
      "Failed to load face_mesh.js. Check public/@mediapipe/face_mesh/ exists.",
    ));
    document.head.appendChild(s);
  });
}

function getFaceMeshCtor(): FaceMeshCtor | null {
  return (window as unknown as { FaceMesh?: FaceMeshCtor }).FaceMesh ?? null;
}

/**
 * Compute gaze X from MediaPipe normalised landmarks.
 * selfieMode:true → looking right gives higher x.
 *
 * If 478 keypoints are available (refineLandmarks:true):  iris-based (accurate).
 * Otherwise falls back to head-pose proxy (nose vs face centre).
 *
 * Returns −1 (looking left = Restroom) … +1 (looking right = Chat).
 */
function calcGazeX(kp: Array<{ x: number; y: number }>): number | null {
  if (kp.length < 468) return null;
  const faceW = Math.abs(kp[LM.FACE_RIGHT].x - kp[LM.FACE_LEFT].x);
  if (faceW < 0.02) return null; // face too small / too far

  if (kp.length >= 478) {
    // Iris-based (high accuracy)
    const avgIrisX = (kp[LM.LEFT_IRIS].x + kp[LM.RIGHT_IRIS].x) / 2;
    const offset = (avgIrisX - kp[LM.NOSE_TIP].x) / (faceW * 0.25);
    return Math.max(-1, Math.min(1, offset));
  }
  // Head-pose fallback
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
    dwellMs    = 3500,
    threshold  = 0.12,
    onLeftSelect,
    onRightSelect,
    onActivity,
    enabled    = true,
    restartKey = 0,
    cameraDeviceId,
  } = options;

  const dwellMsRef   = useRef(dwellMs);
  dwellMsRef.current = dwellMs;
  const thresholdRef   = useRef(threshold);
  thresholdRef.current = threshold;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<IrisGazeState>({
    zone: "none", leftProgress: 0, rightProgress: 0,
    gazeX: 0, faceDetected: false, isReady: false, error: null,
  });

  const dLeftRef          = useRef(0);
  const dRightRef         = useRef(0);
  const faceLostAtRef     = useRef<number | null>(null);
  const lastActivityAtRef = useRef(0);
  const lastTsRef         = useRef<number | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef       = useRef<FaceMeshInstance | null>(null);
  const rafRef            = useRef<number | null>(null);
  const cancelledRef      = useRef(false);
  const sendingRef        = useRef(false);

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
    try { faceMeshRef.current?.close(); } catch { /* ignore */ }
    faceMeshRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    canvasRef.current = null;
    sendingRef.current   = false;
    lastTsRef.current    = null;
    faceLostAtRef.current = null;
    dLeftRef.current  = 0;
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
        // ── 1. Load face_mesh.js (self-hosted at public/@mediapipe/face_mesh/) ──
        setInitStatus("Loading face model…");
        await loadFaceMeshScript();
        if (localCancel || cancelledRef.current) return;

        const FaceMeshCtor = getFaceMeshCtor();
        if (!FaceMeshCtor) {
          throw new Error("window.FaceMesh not found. Reload the page.");
        }

        // ── 2. Create FaceMesh instance ──
        const fm = new FaceMeshCtor({
          locateFile: (file: string) => `/@mediapipe/face_mesh/${file}`,
        });
        fm.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,        // 468-point model — fast & reliable
          selfieMode: true,              // x coords already in user's perspective
          minDetectionConfidence: 0.2,
          minTrackingConfidence: 0.2,
        });
        faceMeshRef.current = fm;

        // ── 3. Register results callback ──
        fm.onResults((results: FaceMeshResult) => {
          if (localCancel || cancelledRef.current) return;
          setResultCount((n) => n + 1);

          const now  = performance.now();
          const last = lastTsRef.current ?? now;
          const dt   = Math.min(Math.max(now - last, 0), 100);
          lastTsRef.current = now;

          const kp       = results.multiFaceLandmarks?.[0];
          const kpCount  = kp ? kp.length : -1;
          setKpLen(kpCount);

          const gx               = kp ? calcGazeX(kp) : null;
          const faceMeshDetected = kpCount > 0;
          const valid            = gx !== null;

          let zone: GazeZone = "none";
          let gazeXVal   = 0;
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
        });

        // ── 4. Open camera ──
        setInitStatus("Starting camera…");
        const videoConstraints: MediaTrackConstraints = cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

        // Enumerate cameras (labels available after getUserMedia)
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
          fm.close();
          return;
        }
        streamRef.current = stream;

        // ── 5. Wait for videoRef to mount (up to 5s) ──
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
            setState((s) => ({ ...s, error: "Video element not ready. Reload the page.", isReady: false }));
          }
          return;
        }

        video.srcObject   = stream;
        video.muted       = true;
        video.playsInline = true;
        await video.play().catch(() => {});

        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          fm.close();
          return;
        }

        setInitStatus("");
        setState((s) => ({ ...s, isReady: true, error: null }));

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }

        // ── 6. RAF loop: send each frame to FaceMesh ──
        let diagCounter = 0;
        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;
          rafRef.current = requestAnimationFrame(runLoop);

          const vid  = videoRef.current;
          const mesh = faceMeshRef.current;
          if (!vid || !mesh || vid.readyState < 2) return;
          if (sendingRef.current) return; // previous frame still processing
          if (vid.videoWidth === 0) return;

          // Diagnostics every 30 frames
          if (diagCounter++ % 30 === 0) {
            let brightness = -1;
            try {
              const cvs = canvasRef.current!;
              if (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight) {
                cvs.width  = vid.videoWidth;
                cvs.height = vid.videoHeight;
              }
              const ctx2 = cvs.getContext("2d");
              if (ctx2) {
                ctx2.drawImage(vid, 0, 0);
                const px = ctx2.getImageData(
                  Math.floor(cvs.width / 2) - 2, Math.floor(cvs.height / 2) - 2, 4, 4,
                );
                brightness = Math.round(
                  Array.from(px.data).reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0) / (4 * 4 * 3),
                );
              }
            } catch { /* ignore */ }
            setVideoSize({ w: vid.videoWidth, h: vid.videoHeight, paused: vid.paused, brightness });
            if (vid.paused) { vid.play().catch(() => {}); }
          }

          sendingRef.current = true;
          setFrameCount((n) => n + 1);
          // Send video frame directly — COOP/COEP headers removed so this works
          mesh.send({ image: vid })
            .catch(() => { /* per-frame errors ignored */ })
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
  }, [enabled, restartKey, stopAll, bumpActivity, cameraDeviceId]);

  return { videoRef, frameCount, resultCount, kpLen, videoSize, initStatus, cameras, ...state };
}
