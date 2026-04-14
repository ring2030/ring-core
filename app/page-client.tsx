"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { ConversationView } from "@/components/kiyoko/ConversationView";
import { GazeStatusBar } from "@/components/kiyoko/GazeStatusBar";
import { GazeTargetPanel } from "@/components/kiyoko/GazeTargetPanel";
import { SleepOverlay } from "@/components/kiyoko/SleepOverlay";
import {
  CAL_TS_KEY,
  EYEDID_CAL_KEY,
  hasFreshEyedidCalibration,
} from "@/lib/gaze/eyedidStorage";
import { getStoredGazeEngine, setStoredGazeEngine } from "@/lib/gaze/gazeEngineStorage";
import { getStoredIrisCameraId } from "@/lib/gaze/irisCameraStorage";
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
  saveGazeTuning,
  type GazeTuning,
} from "@/lib/gaze/tuning";
import { SLEEP_TIMEOUT_MS, TARGET_SCAN_MS, PROGRESS_TICK_MS } from "@/lib/constants";
import {
  getStoredInputMode,
  setStoredInputMode,
  type NurseInputMode,
} from "@/lib/gaze/inputModeStorage";
import { Volume2 } from "lucide-react";

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
  /** true: MediaPipe 虹彩 / false: Eyedid */
  const [gazeMode, setGazeMode] = useState(true);
  const [irisRestartKey, setIrisRestartKey] = useState(0);
  const [irisCameraDeviceId, setIrisCameraDeviceId] = useState<string | undefined>(undefined);

  const [gazeHydrated, setGazeHydrated] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [cameraSessionStarted, setCameraSessionStarted] = useState(false);
  const [cameraGateError, setCameraGateError] = useState<string | null>(null);
  const [bootstrapVersion, setBootstrapVersion] = useState(0);

  useEffect(() => {
    const mode = getStoredInputMode();
    const engine = getStoredGazeEngine();
    const useIris = engine === "iris";
    setInputMode(mode);
    setGazeMode(useIris);
    setGazeTuning(loadGazeTuning());
    setIrisCameraDeviceId(getStoredIrisCameraId());

    if (mode === "pointer") {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("タッチ・マウスで操作");
    } else if (useIris) {
      setIsCalibrating(false);
      setCameraSessionStarted(true);
      setStatusMessage("視線を検知中…");
    } else {
      const fresh = hasFreshEyedidCalibration();
      setIsCalibrating(!fresh);
      setCameraSessionStarted(fresh);
      setStatusMessage(fresh ? "視線を検知中…" : "カメラを準備しています...");
    }
    setGazeHydrated(true);
  }, []);

  useEffect(() => {
    if (!gazeHydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("recalibrate") !== "1") return;
    try {
      localStorage.removeItem(CAL_TS_KEY);
      localStorage.removeItem(EYEDID_CAL_KEY);
    } catch {
      /* ignore */
    }
    setCameraGateError(null);
    setCameraSessionStarted(false);
    setIsCalibrating(true);
    setBootstrapVersion((k) => k + 1);
    window.history.replaceState({}, "", window.location.pathname);
  }, [gazeHydrated]);

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
    setStoredGazeEngine(useIris ? "iris" : "eyedid");
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
    calUi,
    skipCalibration,
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
    setStatusMessage("視線を検知中…");
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
    isReady: state_irisReady,
    error: irisError,
  } = useIrisGaze({
    enabled: irisEnabled,
    restartKey: irisRestartKey,
    cameraDeviceId: irisCameraDeviceId,
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

  const combinedError =
    inputMode === "eyedid" ? trackingError ?? cameraError : cameraError;

  const faceHint =
    inputMode === "eyedid" &&
    gazeMode &&
    state_irisReady &&
    !irisFaceDetected &&
    !combinedError
      ? "顔を画面に向けてください"
      : null;

  const showCameraRestartHint =
    Boolean(!combinedError &&
      inputMode === "eyedid" &&
      !gazeMode &&
      (statusMessage.includes("カメラを準備") || statusMessage.includes("準備しています")));

  if (!gazeHydrated) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans select-none">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400" aria-hidden />
        <p className="mt-5 text-lg text-cyan-100/85">準備しています…</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans select-none">

      {!audioReady && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[10001] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-900/90 px-5 py-2.5 text-sm text-slate-200 shadow-lg backdrop-blur-md animate-pulse">
          <Volume2 className="size-4 shrink-0 text-amber-300/90" strokeWidth={2} aria-hidden />
          <span>画面を一度タップすると音が鳴ります</span>
        </div>
      )}

      {isSleepMode && <SleepOverlay onWakeUp={handleWakeUp} />}

      {inputMode === "eyedid" && gazeMode && (
        <video
          ref={irisVideoRef}
          width={320}
          height={240}
          className="pointer-events-none fixed"
          style={{
            width: 1,
            height: 1,
            top: 0,
            left: 0,
            opacity: 0,
            zIndex: 0,
          }}
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
          onSwitchToIris={() => handleGazeEngineChange(true)}
        />
      )}

      {!isSuccess && !isCalibrating && (
        <div
          className="pointer-events-none fixed h-48 w-48 animate-pulse rounded-full bg-amber-300/35 mix-blend-screen blur-2xl transition-all duration-100"
          style={{
            left: displayGazeX - 96,
            top: displayGazeY - 96,
            display: displayGazeX > 0 ? "block" : "none",
            zIndex: 9999,
          }}
        />
      )}

      {isSuccess ? (
        <div className="flex h-full w-full flex-col items-center justify-center px-8">
          {sentReason === "トイレ" ? (
            <div className="rounded-[4rem] border-8 border-orange-600/45 bg-gradient-to-br from-slate-900 to-slate-950 p-16 text-center shadow-2xl sm:p-24">
              <h1 className="mb-8 text-[clamp(2.5rem,10vmin,6rem)] font-black leading-tight text-orange-300">
                みっちゃんさんに
                <br />
                伝えましたよ！
              </h1>
              <p className="text-[clamp(1.25rem,4vmin,3rem)] font-bold text-slate-300">
                すぐに行くから、待っててね。
              </p>
            </div>
          ) : (
            <ErrorBoundary
              fallback={() => (
                <button
                  type="button"
                  onClick={resetToMain}
                  className="rounded-full bg-slate-700 px-12 py-6 text-2xl font-bold text-slate-200"
                >
                  もどる
                </button>
              )}
            >
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
        <div className="flex w-full flex-col items-center justify-center px-5 pb-10 pt-20 sm:px-10 sm:pt-24">
          <GazeStatusBar
            errorMessage={combinedError}
            onRestartCamera={() => {
              setCameraError(null);
              setStatusMessage("カメラを準備しています...");
              if (gazeMode) {
                setIrisRestartKey((k) => k + 1);
              } else {
                setBootstrapVersion((k) => k + 1);
              }
            }}
            onUsePointerInstead={() => handleInputModeChange("pointer")}
            faceHint={faceHint}
            showCameraRestartHint={showCameraRestartHint}
          />

          <GazeTargetPanel target={displayTarget} progress={displayProgress} />
        </div>
      ) : null}

      <ElderVideoLetterOverlay
        suppressReplayUi={isSuccess || isCalibrating || isSleepMode}
      />
    </div>
  );
}
