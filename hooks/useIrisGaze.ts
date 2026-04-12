"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarksDetector } from "@tensorflow-models/face-landmarks-detection";
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
  /** 顔が安定検出されている間にスリープ解除用など（スロットル付き） */
  onActivity?: () => void;
  enabled?: boolean;
  /** 変更するとカメラ・検出ループを張り直す（UI の「カメラを再起動」用） */
  restartKey?: number;
}

const LM = {
  NOSE_TIP: 1,
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
  FACE_LEFT: 234,
  FACE_RIGHT: 454,
} as const;

function calcGazeX(kp: Array<{ x: number; y: number }>): number | null {
  if (kp.length < 478) return null;
  const avgIrisX = (kp[LM.LEFT_IRIS].x + kp[LM.RIGHT_IRIS].x) / 2;
  const faceW = Math.abs(kp[LM.FACE_RIGHT].x - kp[LM.FACE_LEFT].x);
  if (faceW < 5) return null;
  const offset = (avgIrisX - kp[LM.NOSE_TIP].x) / (faceW * 0.2);
  return Math.max(-1, Math.min(1, offset));
}

function zoneFromGaze(gazeX: number | null, threshold: number): GazeZone {
  if (gazeX === null) return "center";
  if (gazeX < -threshold) return "left";
  if (gazeX > threshold) return "right";
  return "center";
}

const FACE_LOST_RESET_MS = 200;

export function useIrisGaze(options: UseIrisGazeOptions) {
  const {
    dwellMs = 3500,
    threshold = 0.1,
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
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceLandmarksDetector | null>(null);
  const cancelledRef = useRef(false);
  const lastTsRef = useRef<number | null>(null);

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
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    try {
      detectorRef.current?.dispose();
    } catch {
      /* ignore */
    }
    detectorRef.current = null;
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
        ...s,
        zone: "none",
        leftProgress: 0,
        rightProgress: 0,
        gazeX: 0,
        faceDetected: false,
        isReady: false,
      }));
      return;
    }

    cancelledRef.current = false;
    let localCancel = false;

    async function boot() {
      setState((s) => ({ ...s, error: null, isReady: false }));

      try {
        const tf = await import("@tensorflow/tfjs-core");
        await import("@tensorflow/tfjs-backend-webgl");
        await tf.setBackend("webgl");
        await tf.ready();

        const faceLandmarksDetection = await import(
          "@tensorflow-models/face-landmarks-detection"
        );
        const detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "tfjs",
            refineLandmarks: true,
            maxFaces: 1,
          },
        );

        if (localCancel || cancelledRef.current) {
          detector.dispose();
          return;
        }
        detectorRef.current = detector;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          setState((s) => ({
            ...s,
            error: "ビデオ要素が未準備です。",
            isReady: false,
          }));
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        if (localCancel || cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          detector.dispose();
          return;
        }

        setState((s) => ({ ...s, isReady: true, error: null }));

        const runLoop = () => {
          if (localCancel || cancelledRef.current) return;

          rafRef.current = requestAnimationFrame(async (ts) => {
            if (localCancel || cancelledRef.current) return;

            const last = lastTsRef.current ?? ts;
            const dt = Math.min(Math.max(ts - last, 0), 80);
            lastTsRef.current = ts;

            const vid = videoRef.current;
            const det = detectorRef.current;
            if (!vid || !det || vid.readyState < 2) {
              runLoop();
              return;
            }

            let zone: GazeZone = "none";
            let gazeXVal = 0;
            let faceDetected = false;

            try {
              const faces = await det.estimateFaces(vid, {
                flipHorizontal: true,
                staticImageMode: false,
              });

              const now = performance.now();
              const kp = faces[0]?.keypoints;
              const gx =
                kp && kp.length >= 478 ? calcGazeX(kp) : null;
              const valid = faces.length > 0 && gx !== null;

              if (!valid) {
                if (faceLostAtRef.current === null) faceLostAtRef.current = now;
                const lostMs = now - faceLostAtRef.current;
                if (lostMs >= FACE_LOST_RESET_MS) {
                  zone = "none";
                  dLeftRef.current = 0;
                  dRightRef.current = 0;
                } else {
                  zone = "center";
                }
              } else {
                faceLostAtRef.current = null;
                faceDetected = true;
                gazeXVal = gx!;
                zone = zoneFromGaze(gx, thresholdRef.current);
                bumpActivity();
              }

              const d = dwellMsRef.current;
              if (zone === "left") {
                dLeftRef.current = Math.min(d, dLeftRef.current + dt);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 2);
              } else if (zone === "right") {
                dRightRef.current = Math.min(d, dRightRef.current + dt);
                dLeftRef.current = Math.max(0, dLeftRef.current - dt * 2);
              } else if (zone === "center") {
                dLeftRef.current = Math.max(0, dLeftRef.current - dt * 0.8);
                dRightRef.current = Math.max(0, dRightRef.current - dt * 0.8);
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

              const leftProgress = d > 0 ? dLeftRef.current / d : 0;
              const rightProgress = d > 0 ? dRightRef.current / d : 0;

              setState({
                zone,
                leftProgress,
                rightProgress,
                gazeX: gazeXVal,
                faceDetected,
                isReady: true,
                error: null,
              });
            } catch {
              setState((prev) => ({
                ...prev,
                faceDetected: false,
              }));
            } finally {
              runLoop();
            }
          });
        };

        runLoop();
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "初期化に失敗しました";
        setState((s) => ({
          ...s,
          error: msg,
          isReady: false,
          faceDetected: false,
        }));
      }
    }

    void boot();

    return () => {
      localCancel = true;
      cancelledRef.current = true;
      stopAll();
    };
  }, [enabled, restartKey, stopAll, bumpActivity]);

  return { videoRef, ...state };
}
