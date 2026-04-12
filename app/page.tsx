"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useAudio } from "@/lib/useAudio";
import { useEyedidGaze } from "@/hooks/useEyedidGaze";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { ElderVideoLetterOverlay } from "@/components/kiyoko/ElderVideoLetterOverlay";
import { EyedidCalibrationOverlay } from "@/components/kiyoko/EyedidCalibrationOverlay";
import { BottomNav } from "@/components/kiyoko/BottomNav";
import { ConversationView } from "@/components/kiyoko/ConversationView";
import { GazeDebugOverlay } from "@/components/kiyoko/GazeDebugOverlay";
import { GazeStatusBar } from "@/components/kiyoko/GazeStatusBar";
import { GazeTargetPanel } from "@/components/kiyoko/GazeTargetPanel";
import { SleepOverlay } from "@/components/kiyoko/SleepOverlay";
import { TuningPanel } from "@/components/kiyoko/TuningPanel";
import {
  CAL_TS_KEY,
  EYEDID_CAL_KEY,
  hasFreshEyedidCalibration,
} from "@/lib/gaze/eyedidStorage";
import {
  computeNextProgress,
  INITIAL_TARGET_STABILITY,
  selectGazeTarget,
  stepTargetStability,
  type TargetStabilityState,
} from "@/lib/gaze/selection";
import {
  DEFAULT_GAZE_TUNING,
  loadGazeTuning,
  normalizeGazeTuning,
  saveGazeTuning,
  type GazeTuning,
} from "@/lib/gaze/tuning";

const SLEEP_TIMEOUT_MS = 10_000;
const TARGET_SCAN_MS = 120;
const PROGRESS_TICK_MS = 120;

export default function GrandmaGazePage() {
  const [gazePoint, setGazePoint] = useState({ x: -100, y: -100 });
  const [target, setTarget] = useState<"トイレ" | "お話" | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("カメラを準備しています...");

  const [isSuccess, setIsSuccess] = useState(false);
  const [sentReason, setSentReason] = useState("");

  const [windowWidth, setWindowWidth] = useState(1000);
  const [windowHeight, setWindowHeight] = useState(700);
  const [gazeTuning, setGazeTuning] = useState<GazeTuning>(DEFAULT_GAZE_TUNING);
  const [showTuning, setShowTuning] = useState(false);

  // キャリブ／カメラゲートは localStorage 依存のため、SSR と同じ初期値にしてハイドレーションずれを防ぐ
  const [gazeHydrated, setGazeHydrated] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  /** キャリブ画面では「カメラを開始」タップ後に true（キャリブ済みでメインだけのときも true） */
  const [cameraSessionStarted, setCameraSessionStarted] = useState(false);
  const [cameraGateError, setCameraGateError] = useState<string | null>(null);

  useEffect(() => {
    const fresh = hasFreshEyedidCalibration();
    setIsCalibrating(!fresh);
    setCameraSessionStarted(fresh);
    setGazeTuning(loadGazeTuning());
    setGazeHydrated(true);
  }, []);

  useEffect(() => {
    if (!gazeHydrated) return;
    saveGazeTuning(gazeTuning);
  }, [gazeHydrated, gazeTuning]);

  const [bootstrapVersion, setBootstrapVersion] = useState(0);
  const [isSleepMode, setIsSleepMode] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCallIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<{ role: string; text: string }[]>([]);
  const conversationTurnRef = useRef(0);

  const { audioReady, playSubmitSound } = useAudio();

  const isSuccessRef = useRef(false);
  isSuccessRef.current = isSuccess;
  const isCalibrationRef = useRef(true);
  isCalibrationRef.current = isCalibrating;

  const [cameraError, setCameraError] = useState<string | null>(null);

  const onCalibrationComplete = useCallback(() => {
    setIsCalibrating(false);
  }, []);

  const resetSleepTimer = useCallback(() => {
    if (isSuccessRef.current || isCalibrationRef.current) return;
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setIsSleepMode(true), SLEEP_TIMEOUT_MS);
  }, []);

  const onGazePointStable = useCallback((x: number, y: number) => {
    setGazePoint({ x, y });
    setCameraError(null);
  }, []);

  const eyedidEnabled = gazeHydrated && (!isCalibrating || cameraSessionStarted);

  const {
    licenseError: eyedidLicenseError,
    initError: eyedidInitError,
    blinkCount: eyedidBlinkCount,
    attentionScore: eyedidAttention,
    trackingState: eyedidTrackingState,
    calUi,
    skipCalibration,
    setCameraPlacement,
  } = useEyedidGaze({
    isSleepMode,
    isCalibrating,
    bootstrapVersion,
    onGazePoint: onGazePointStable,
    onGazeActivity: resetSleepTimer,
    onStatusMessage: setStatusMessage,
    onCalibrationComplete,
    enabled: eyedidEnabled,
  });

  const resetToMain = useCallback(() => {
    window.speechSynthesis.cancel();
    currentCallIdRef.current = null;
    conversationTurnRef.current = 0;
    hasSubmittedRef.current = false;
    setIsSuccess(false);
    setProgress(0);
    setTarget(null);
    setGazePoint({ x: -100, y: -100 });
    setStatusMessage("視線を検知中...");
  }, []);

  const { aiText, isListening, isThinking } = useVoiceConversation({
    active: isSuccess && sentReason === "お話",
    currentCallIdRef,
    conversationHistoryRef,
    conversationTurnRef,
    onEnd: resetToMain,
  });

  const handleCameraStart = useCallback(async () => {
    setCameraGateError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      stream.getTracks().forEach((t) => t.stop());
      setCameraSessionStarted(true);
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraGateError(
          "カメラの使用が拒否されました。アドレスバー横の鍵アイコンから「許可」にしてください。",
        );
      } else {
        setCameraGateError(
          "カメラを起動できませんでした。カメラの接続とブラウザの設定を確認してください。",
        );
      }
    }
  }, []);

  const trackingError = eyedidLicenseError ?? eyedidInitError ?? null;

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    setWindowHeight(window.innerHeight);
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (eyedidLicenseError) setIsCalibrating(false);
  }, [eyedidLicenseError]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isSuccess && sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  }, [isSuccess]);

  const handleWakeUp = () => {
    setIsSleepMode(false);
    resetSleepTimer();
  };

  const gazeRef = useRef(gazePoint);
  gazeRef.current = gazePoint;
  const targetRef = useRef<"トイレ" | "お話" | null>(null);
  targetRef.current = target;
  const targetStabilityRef = useRef<TargetStabilityState>(INITIAL_TARGET_STABILITY);
  const [debugRawHit, setDebugRawHit] = useState<"トイレ" | "お話" | null>(null);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (isSuccess || isCalibrating || isSleepMode) return;
    const id = setInterval(() => {
      const { x, y } = gazeRef.current;
      const rawHit = selectGazeTarget({
        x,
        y,
        width: windowWidth,
        height: windowHeight,
        leftThresholdRatio: gazeTuning.leftThresholdRatio,
        rightThresholdRatio: gazeTuning.rightThresholdRatio,
      });
      targetStabilityRef.current = stepTargetStability(targetStabilityRef.current, rawHit, {
        confirmFrames: gazeTuning.confirmFrames,
        releaseFrames: gazeTuning.releaseFrames,
      });
      setDebugRawHit(rawHit);
      const next = targetStabilityRef.current.locked;
      setTarget((prev) => (prev === next ? prev : next));
    }, TARGET_SCAN_MS);
    return () => clearInterval(id);
  }, [isSuccess, isCalibrating, isSleepMode, windowWidth, windowHeight, gazeTuning]);

  useEffect(() => {
    if (!isSuccess && !isCalibrating && !isSleepMode) return;
    targetStabilityRef.current = INITIAL_TARGET_STABILITY;
    setTarget(null);
    setDebugRawHit(null);
  }, [isSuccess, isCalibrating, isSleepMode]);

  useEffect(() => {
    if (isSuccess || isCalibrating || isSleepMode) return;
    const interval = setInterval(() => {
      setProgress((prev) =>
        computeNextProgress(
          prev,
          Boolean(target),
          gazeTuning.risePerTick,
          gazeTuning.fallPerTick,
        ),
      );
    }, PROGRESS_TICK_MS);
    return () => clearInterval(interval);
  }, [target, isSuccess, isCalibrating, isSleepMode, gazeTuning]);

  useEffect(() => {
    if (progress >= 100 && !isSuccess && !hasSubmittedRef.current && targetRef.current) {
      hasSubmittedRef.current = true;
      submitCall(targetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const submitCall = async (reason: string) => {
    setIsSuccess(true);
    setSentReason(reason);
    if (reason === "お話") {
      conversationTurnRef.current = 0;
      conversationHistoryRef.current = [];
    }
    playSubmitSound();
    currentCallIdRef.current = null;

    try {
      const docRef = await addDoc(collection(getFirestoreDb(), "calls"), {
        理由: [reason],
        特記事項: reason === "トイレ" ? "視線入力からの自動送信" : "AI会話開始",
        送信者: "きよ子",
        送信日時: serverTimestamp(),
      });
      currentCallIdRef.current = docRef.id;
    } catch {}

    if (reason === "トイレ") {
      setTimeout(() => resetToMain(), 5000);
    }
  };

  if (!gazeHydrated) {
    return (
      <div className="relative min-h-screen bg-slate-900 font-sans overflow-hidden select-none flex flex-col items-center justify-center">
        <p className="text-slate-400 text-xl">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900 font-sans overflow-hidden select-none flex flex-col items-center justify-center">

      {!audioReady && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-2 rounded-full bg-slate-700/90 px-5 py-2.5 text-sm text-slate-300 shadow-lg backdrop-blur-sm pointer-events-none animate-pulse">
          <span>🔔</span>
          <span>タップで通知音を有効化</span>
        </div>
      )}

      {isSleepMode && <SleepOverlay onWakeUp={handleWakeUp} />}

      {isCalibrating && !eyedidLicenseError && (
        <EyedidCalibrationOverlay
          calUi={calUi}
          onSkip={skipCalibration}
          errorText={cameraGateError ?? trackingError}
          showCameraGate={!cameraSessionStarted}
          onCameraStart={handleCameraStart}
          onRetrySdk={() => {
            setCameraGateError(null);
            setBootstrapVersion((k) => k + 1);
          }}
        />
      )}

      {!isSuccess && !isCalibrating && (
        <div
          className="fixed w-48 h-48 rounded-full bg-amber-400 opacity-40 mix-blend-screen pointer-events-none transition-all duration-100 blur-2xl animate-pulse"
          style={{
            left: gazePoint.x - 96,
            top: gazePoint.y - 96,
            display: gazePoint.x > 0 ? "block" : "none",
            zIndex: 9999,
          }}
        />
      )}

      {isSuccess ? (
        <div className="flex flex-col items-center justify-center w-full h-full px-8">
          {sentReason === "トイレ" ? (
            <div className="bg-slate-800 p-24 rounded-[4rem] shadow-2xl text-center border-8 border-orange-700/60">
              <h1 className="text-[6rem] font-black text-orange-400 mb-8 leading-tight">
                みっちゃんさんに<br />伝えましたよ！
              </h1>
              <p className="text-[3rem] font-bold text-slate-300">すぐに行くから、待っててね。</p>
            </div>
          ) : (
            <ConversationView
              aiText={aiText}
              isListening={isListening}
              isThinking={isThinking}
              onEnd={resetToMain}
            />
          )}
        </div>
      ) : !isCalibrating ? (
        <div className="w-full h-full px-12 flex flex-col items-center justify-center">
          <GazeStatusBar
            statusMessage={statusMessage}
            trackingError={trackingError}
            cameraError={cameraError}
            trackingState={eyedidTrackingState}
            gazePointX={gazePoint.x}
            onRestartCamera={() => {
              setCameraError(null);
              setStatusMessage("カメラを準備しています...");
              setBootstrapVersion((k) => k + 1);
            }}
            onRecalibrate={() => {
              try {
                localStorage.removeItem(CAL_TS_KEY);
                localStorage.removeItem(EYEDID_CAL_KEY);
              } catch { /* ignore */ }
              setCameraGateError(null);
              setCameraSessionStarted(false);
              setIsCalibrating(true);
              setBootstrapVersion((k) => k + 1);
            }}
            onCameraPlacement={setCameraPlacement}
            showTuning={showTuning}
            onToggleTuning={() => setShowTuning((v) => !v)}
          />

          {showTuning && (
            <TuningPanel
              gazeTuning={gazeTuning}
              onTuningChange={(t) => setGazeTuning(normalizeGazeTuning(t))}
              onClose={() => setShowTuning(false)}
            />
          )}

          {!trackingError && (
            <GazeDebugOverlay
              blinkCount={eyedidBlinkCount}
              attentionScore={eyedidAttention}
              trackingState={eyedidTrackingState}
              debugRawHit={debugRawHit}
              stability={targetStabilityRef.current}
              confirmFrames={gazeTuning.confirmFrames}
            />
          )}

          <GazeTargetPanel target={target} progress={progress} />
        </div>
      ) : null}

      <ElderVideoLetterOverlay
        suppressReplayUi={isSuccess || isCalibrating || isSleepMode}
      />

      {!isSleepMode && <BottomNav />}
    </div>
  );
}
