"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useAudio } from "@/lib/useAudio";
import { useEyedidGaze } from "@/hooks/useEyedidGaze";
import { useIrisGaze } from "@/hooks/useIrisGaze";
import { usePointerGaze } from "@/hooks/usePointerGaze";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { SLEEP_TIMEOUT_MS, TARGET_SCAN_MS, PROGRESS_TICK_MS } from "@/lib/constants";
import {
  getStoredInputMode,
  setStoredInputMode,
  type NurseInputMode,
} from "@/lib/gaze/inputModeStorage";

export default function GrandmaGazePage() {
  const [gazePoint, setGazePoint] = useState({ x: -100, y: -100 });
  const [target, setTarget] = useState<"トイレ" | "お話" | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("カメラを準備しています...");
  const [inputMode, setInputMode] = useState<NurseInputMode>("eyedid");

  const [isSuccess, setIsSuccess] = useState(false);
  const [sentReason, setSentReason] = useState("");

  const [windowWidth, setWindowWidth] = useState(1000);
  const [windowHeight, setWindowHeight] = useState(700);
  const [gazeTuning, setGazeTuning] = useState<GazeTuning>(DEFAULT_GAZE_TUNING);
  const [showTuning, setShowTuning] = useState(false);
  /** true: MediaPipe 虹彩 / false: Eyedid（seeso）ロールバック用 */
  const [gazeMode, setGazeMode] = useState(true);
  const [irisRestartKey, setIrisRestartKey] = useState(0);

  // キャリブ／カメラゲートは localStorage 依存のため、SSR と同じ初期値にしてハイドレーションずれを防ぐ
  const [gazeHydrated, setGazeHydrated] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  /** キャリブ画面では「カメラを開始」タップ後に true（キャリブ済みでメインだけのときも true） */
  const [cameraSessionStarted, setCameraSessionStarted] = useState(false);
  const [cameraGateError, setCameraGateError] = useState<string | null>(null);

  useEffect(() => {
    const mode = getStoredInputMode();
    setInputMode(mode);
    setGazeTuning(loadGazeTuning());
    if (mode === "pointer") {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("タッチ・マウスで操作");
    } else if (gazeMode) {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("視線を検知中…");
    } else {
      const fresh = hasFreshEyedidCalibration();
      setIsCalibrating(!fresh);
      setCameraSessionStarted(fresh);
    }
    setGazeHydrated(true);
    // gazeMode は初回マウント時の値のみ（常に true）でよい — 切替は handleGazeEngineChange が担当
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputModeChange = useCallback((mode: NurseInputMode) => {
    setStoredInputMode(mode);
    setInputMode(mode);
    setCameraGateError(null);
    if (mode === "pointer") {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("タッチ・マウスで操作");
      setGazePoint({ x: -100, y: -100 });
    } else if (gazeMode) {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("視線を検知中…");
      setBootstrapVersion((k) => k + 1);
    } else {
      const fresh = hasFreshEyedidCalibration();
      setIsCalibrating(!fresh);
      setCameraSessionStarted(fresh);
      setStatusMessage(fresh ? "視線を検知中…" : "カメラを準備しています...");
      setBootstrapVersion((k) => k + 1);
    }
  }, [gazeMode]);

  const handleGazeEngineChange = useCallback((useIris: boolean) => {
    setGazeMode(useIris);
    setCameraGateError(null);
    if (useIris) {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("視線を検知中…");
      setIrisRestartKey((k) => k + 1);
    } else {
      const fresh = hasFreshEyedidCalibration();
      setIsCalibrating(!fresh);
      setCameraSessionStarted(fresh);
      setStatusMessage(fresh ? "視線を検知中…" : "カメラを準備しています…");
      setBootstrapVersion((k) => k + 1);
    }
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

  const eyedidEnabled =
    gazeHydrated &&
    inputMode === "eyedid" &&
    !gazeMode &&
    (!isCalibrating || cameraSessionStarted);

  usePointerGaze({
    enabled:
      gazeHydrated &&
      inputMode === "pointer" &&
      !isSuccess &&
      !isSleepMode,
    onPoint: onGazePointStable,
    onActivity: resetSleepTimer,
  });

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

  const hasSubmittedRef = useRef(false);

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

  const submitCall = useCallback(
    async (reason: string) => {
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
      } catch {
        /* ignore */
      }

      if (reason === "トイレ") {
        setTimeout(() => resetToMain(), 5000);
      }
    },
    [playSubmitSound, resetToMain],
  );

  const irisEnabled =
    gazeHydrated &&
    inputMode === "eyedid" &&
    gazeMode &&
    !isSuccess &&
    !isSleepMode &&
    !isCalibrating;

  const {
    videoRef: irisVideoRef,
    zone: irisZone,
    leftProgress: irisLeftProgress,
    rightProgress: irisRightProgress,
    gazeX: irisGazeX,
    faceDetected: irisFaceDetected,
    error: irisError,
  } = useIrisGaze({
    enabled: irisEnabled,
    restartKey: irisRestartKey,
    onLeftSelect: () => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;
      void submitCall("トイレ");
    },
    onRightSelect: () => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;
      void submitCall("お話");
    },
    onActivity: resetSleepTimer,
  });

  const trackingError =
    inputMode === "eyedid" && gazeMode
      ? irisError
      : eyedidLicenseError ?? eyedidInitError ?? null;

  const legacyGazePipeline =
    gazeHydrated &&
    (inputMode === "pointer" || (inputMode === "eyedid" && !gazeMode));

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

  useEffect(() => {
    if (!legacyGazePipeline || isSuccess || isCalibrating || isSleepMode) return;
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
  }, [
    legacyGazePipeline,
    isSuccess,
    isCalibrating,
    isSleepMode,
    windowWidth,
    windowHeight,
    gazeTuning,
  ]);

  useEffect(() => {
    if (!isSuccess && !isCalibrating && !isSleepMode) return;
    targetStabilityRef.current = INITIAL_TARGET_STABILITY;
    setTarget(null);
    setDebugRawHit(null);
  }, [isSuccess, isCalibrating, isSleepMode]);

  useEffect(() => {
    if (!legacyGazePipeline || isSuccess || isCalibrating || isSleepMode) return;
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
  }, [legacyGazePipeline, target, isSuccess, isCalibrating, isSleepMode, gazeTuning]);

  useEffect(() => {
    if (progress >= 100 && !isSuccess && !hasSubmittedRef.current && targetRef.current) {
      hasSubmittedRef.current = true;
      submitCall(targetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, submitCall]);

  const irisUiActive = irisEnabled;

  const displayGazeX =
    irisUiActive && irisFaceDetected
      ? ((irisGazeX + 1) / 2) * windowWidth
      : gazePoint.x;
  const displayGazeY =
    irisUiActive && irisFaceDetected ? windowHeight * 0.58 : gazePoint.y;

  const displayTarget: "トイレ" | "お話" | null = irisUiActive
    ? irisZone === "left"
      ? "トイレ"
      : irisZone === "right"
        ? "お話"
        : null
    : target;

  const displayProgress = irisUiActive
    ? irisZone === "left"
      ? irisLeftProgress * 100
      : irisZone === "right"
        ? irisRightProgress * 100
        : 0
    : progress;

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

      {inputMode === "eyedid" && gazeMode && (
        <video
          ref={irisVideoRef}
          className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
          playsInline
          muted
          autoPlay
        />
      )}

      {isCalibrating && !eyedidLicenseError && inputMode === "eyedid" && !gazeMode && (
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
            left: displayGazeX - 96,
            top: displayGazeY - 96,
            display: displayGazeX > 0 ? "block" : "none",
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
            <ErrorBoundary fallback={() => (
              <button onClick={resetToMain} className="px-12 py-6 bg-slate-700 text-slate-200 text-2xl font-bold rounded-full">
                もどる
              </button>
            )}>
              <ConversationView
                aiText={aiText}
                isListening={isListening}
                isThinking={isThinking}
                onEnd={resetToMain}
              />
            </ErrorBoundary>
          )}
        </div>
      ) : !isCalibrating ? (
        <div className="flex w-full flex-col items-center justify-center px-6 pb-8 pt-28 sm:px-12 sm:pt-32">
          <GazeStatusBar
            inputMode={inputMode}
            onInputModeChange={handleInputModeChange}
            gazeMode={gazeMode}
            onGazeEngineChange={handleGazeEngineChange}
            statusMessage={statusMessage}
            trackingError={inputMode === "eyedid" ? trackingError : null}
            cameraError={cameraError}
            trackingState={gazeMode ? null : eyedidTrackingState}
            irisFaceDetected={
              inputMode === "eyedid" && gazeMode ? irisFaceDetected : null
            }
            gazePointX={displayGazeX}
            onRestartCamera={() => {
              setCameraError(null);
              setStatusMessage("カメラを準備しています...");
              if (gazeMode) {
                setIrisRestartKey((k) => k + 1);
              } else {
                setBootstrapVersion((k) => k + 1);
              }
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

          {process.env.NODE_ENV === "development" &&
            inputMode === "eyedid" &&
            !gazeMode &&
            !trackingError && (
            <GazeDebugOverlay
              blinkCount={eyedidBlinkCount}
              attentionScore={eyedidAttention}
              trackingState={eyedidTrackingState}
              debugRawHit={debugRawHit}
              stability={targetStabilityRef.current}
              confirmFrames={gazeTuning.confirmFrames}
            />
          )}

          <GazeTargetPanel target={displayTarget} progress={displayProgress} />
        </div>
      ) : null}

      <ElderVideoLetterOverlay
        suppressReplayUi={isSuccess || isCalibrating || isSleepMode}
      />

      {!isSleepMode && <BottomNav />}
    </div>
  );
}
