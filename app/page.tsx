"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useAudio } from "@/lib/useAudio";
import { ElderVideoLetterOverlay } from "@/components/kiyoko/ElderVideoLetterOverlay";
import { EyedidCalibrationOverlay } from "@/components/kiyoko/EyedidCalibrationOverlay";
import { useEyedidGaze } from "@/hooks/useEyedidGaze";
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

// API ルートから import type すると Next.js のサーバー/クライアント境界を越えるため
// 型だけここで定義する
interface TriageResponse {
  response: string;
  summary:  string;
  priority: number;
}

type SpeechRecognitionResultLike = {
  transcript?: string;
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionErrorEventLike = {
  error?: string;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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

  const [aiText, setAiText] = useState("お話し相手を呼んでいます...");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationTurn, setConversationTurn] = useState(0);

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
  /** カメラ再起動・再キャリブレーションで増やし Eyedid を初期化し直す */
  const [bootstrapVersion, setBootstrapVersion] = useState(0);

  // スリープモード
  const [isSleepMode, setIsSleepMode] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // トリアージ: Firestore に書いたドキュメント ID を保持（AI応答後に更新するため）
  const currentCallIdRef = useRef<string | null>(null);

  // 会話履歴（Gemini に渡すターン履歴）
  const conversationHistoryRef = useRef<{ role: string; text: string }[]>([]);

  // 通知音（ブラウザの自動再生制限に対応）
  const { audioReady, playSubmitSound } = useAudio();

  // isSuccess / isCalibrating の最新値をクロージャから安全に読むための ref
  const isSuccessRef = useRef(false);
  isSuccessRef.current = isSuccess;
  const isCalibrationRef = useRef(true);
  isCalibrationRef.current = isCalibrating;

  // カメラ／SDK エラー表示用（Eyedid フックと併用）
  const [cameraError, setCameraError] = useState<string | null>(null);

  const onCalibrationComplete = useCallback(() => {
    setIsCalibrating(false);
  }, []);

  // スリープタイマーリセット（useEffect に依存しない安定した関数）
  // refs だけ使うので deps は空 → 毎レンダーで再生成されない
  const resetSleepTimer = useCallback(() => {
    // 送信中・AI会話中・キャリブレーション中はスリープさせない
    if (isSuccessRef.current || isCalibrationRef.current) return;
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setIsSleepMode(true), SLEEP_TIMEOUT_MS);
  }, []);

  const onGazePointStable = useCallback((x: number, y: number) => {
    setGazePoint({ x, y });
    setCameraError(null);
  }, []);

  /** メイン画面（キャリブ不要）では常に起動。キャリブ画面では「カメラを開始」後だけ起動 */
  const eyedidEnabled =
    gazeHydrated && (!isCalibrating || cameraSessionStarted);

  const {
    licenseError: eyedidLicenseError,
    initError: eyedidInitError,
    blinkCount: eyedidBlinkCount,
    attentionScore: eyedidAttention,
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

  /** ユーザー操作の直列で getUserMedia し、その後 SDK が同じ権限で起動しやすくする */
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

  // ライセンス未設定時はキャリブレーション UI を閉じてメッセージを見せる
  useEffect(() => {
    if (eyedidLicenseError) setIsCalibrating(false);
  }, [eyedidLicenseError]);

  // 省電力タイマーは「視線が来たとき」（onGazeActivity）と「スリープ解除後」だけで開始する。
  // マウント直後に開始すると、キャリブ済みユーザーが SDK 起動前に 10 秒でスリープし
  // stopTracking されて視線が止まるため、ここでは開始しない。
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  // isSuccess が true（送信中/AI会話中）になったらタイマーを即クリア
  useEffect(() => {
    if (isSuccess && sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  }, [isSuccess]);

  // スリープ解除：タッチ時にオーバーレイを消してタイマーを再開
  const handleWakeUp = () => {
    setIsSleepMode(false);
    resetSleepTimer();
  };

  // 当たり判定（左右）— 150ms ごとに評価してリレンダーを抑制
  const gazeRef = useRef(gazePoint);
  gazeRef.current = gazePoint;
  // target の最新値を updater 外から参照するための ref
  const targetRef = useRef<"トイレ" | "お話" | null>(null);
  targetRef.current = target;
  const targetStabilityRef = useRef<TargetStabilityState>(INITIAL_TARGET_STABILITY);
  // 二重送信防止フラグ
  const hasSubmittedRef = useRef(false);
  const conversationTurnRef = useRef(0);
  conversationTurnRef.current = conversationTurn;
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
      const next = targetStabilityRef.current.locked;
      setTarget((prev) => (prev === next ? prev : next));
    }, TARGET_SCAN_MS);
    return () => clearInterval(id);
  }, [isSuccess, isCalibrating, isSleepMode, windowWidth, windowHeight, gazeTuning]);

  useEffect(() => {
    if (!isSuccess && !isCalibrating && !isSleepMode) return;
    targetStabilityRef.current = INITIAL_TARGET_STABILITY;
    setTarget(null);
  }, [isSuccess, isCalibrating, isSleepMode]);

  // 滞留ゲージ（updater は純粋に数値だけ更新。submitCall はここで呼ばない）
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

  // progress が 100 に達したら submitCall を起動（updater の外で呼ぶことで二重呼び出しを防止）
  useEffect(() => {
    if (progress >= 100 && !isSuccess && !hasSubmittedRef.current && targetRef.current) {
      hasSubmittedRef.current = true;
      submitCall(targetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // AI会話システム
  // ────────────────────────────────────────────────────────────────
  // 設計方針
  //   1. デバウンス: onresult が来るたびにバッファへ追記し、
  //      最後の発話から 2 秒間入力がなかった場合だけ API 送信
  //   2. ノイズ除去: 2 秒後に空白除去した文字が 3 文字未満なら
  //      API を叩かずバッファをリセットして再聴取
  //   3. マイク制御: isSuccess=true になった時だけ起動し、
  //      会話終了時は必ず recognition.abort() でマイクを停止
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSuccess || sentReason !== "お話") return;

    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    const recognition = SR ? new SR() : null;
    const synth = window.speechSynthesis;

    // ── ローカル変数 ──────────────────────────────────────────────
    let mounted = true;
    let shouldContinueConversation = true;
    let thinking = false;
    let speechBuffer = "";                                          // デバウンス用テキストバッファ
    let debounceTimer: ReturnType<typeof setTimeout> | null = null; // 3.5 秒待機タイマー
    let noSpeechTimer: ReturnType<typeof setTimeout> | null = null; // 15 秒無音タイムアウト

    // ── タイマーユーティリティ ────────────────────────────────────
    const clearDebounce = () => {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    };
    const clearNoSpeech = () => {
      if (noSpeechTimer) { clearTimeout(noSpeechTimer); noSpeechTimer = null; }
    };

    // ── 音声合成ヘルパー ─────────────────────────────────────────
    const getJpVoice = (): Promise<SpeechSynthesisVoice | null> =>
      new Promise((resolve) => {
        const pick = (voices: SpeechSynthesisVoice[]) =>
          voices.find((v) => v.name.includes("Nanami") && v.name.includes("Online")) ||
          voices.find((v) => v.lang === "ja-JP" && !v.localService) ||
          voices.find((v) => v.lang === "ja-JP") ||
          null;
        const voices = synth.getVoices();
        if (voices.length > 0) {
          resolve(pick(voices));
        } else {
          synth.addEventListener("voiceschanged", () => resolve(pick(synth.getVoices())), { once: true });
        }
      });

    const makeUtter = async (text: string) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP"; u.rate = 0.9; u.pitch = 1.1;
      u.voice = await getJpVoice();
      return u;
    };

    // ── マイク起動（会話継続用） ──────────────────────────────────
    // 注意: デバウンス収集中の再起動は startListening() を経由しない
    const startListening = () => {
      if (!mounted || thinking || !recognition || !shouldContinueConversation) return;
      speechBuffer = "";
      clearDebounce();
      setAiText("（話しかけてください...）");
      setIsListening(true);
      // 15 秒無音で自動終了
      clearNoSpeech();
      noSpeechTimer = setTimeout(() => {
        if (!mounted || !shouldContinueConversation) return;
        speakAndFinish("またお話ししましょうね。");
      }, 15_000);
      try { recognition.start(); } catch { /* 既に起動中は無視 */ }
    };

    // ── AI 発話 → 再聴取 ──────────────────────────────────────────
    const speakAndListen = async (text: string) => {
      if (!mounted) return;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = await makeUtter(text);
      u.onend = () => {
        // TTS 音声がスピーカーから消えてから認識開始（自分の声を拾わないように1200ms待機）
        if (mounted && shouldContinueConversation) {
          setTimeout(() => { if (mounted && shouldContinueConversation) startListening(); }, 1_200);
        }
      };
      synth.cancel();
      synth.speak(u);
    };

    // ── 会話終了 → マイク停止 → resetToMain ─────────────────────
    const speakAndFinish = async (text: string) => {
      if (!mounted) return;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      // マイクを即停止（要件3）
      if (recognition) { try { recognition.stop(); } catch {} }
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = await makeUtter(text);
      u.onend = () => { if (mounted) resetToMain(); };
      synth.cancel();
      synth.speak(u);
    };

    // ── API 送信（デバウンス後に確定テキストを渡す） ──────────────
    const sendToApi = async (finalText: string) => {
      if (!mounted || !shouldContinueConversation || thinking) return;

      // 10 ターン上限
      if (conversationTurnRef.current >= 10) {
        speakAndFinish("きよ子さんのお話、みっちゃんにしっかり伝えましたから、ゆっくり休んでくださいね。");
        return;
      }

      // updater 外で ref を更新（Strict Mode 二重実行でズレないように）
      const nextTurn = conversationTurnRef.current + 1;
      conversationTurnRef.current = nextTurn;
      setConversationTurn(nextTurn);

      // API 送信中はマイクを止める（要件3 + 429 防止）
      if (recognition) { try { recognition.stop(); } catch {} }
      thinking = true;
      setIsThinking(true);
      setIsListening(false);
      setAiText(`「${finalText}」...`);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: finalText,
            history: conversationHistoryRef.current,
          }),
        });
        const data: TriageResponse = await res.json();
        if (mounted) {
          // 会話履歴を更新
          conversationHistoryRef.current = [
            ...conversationHistoryRef.current,
            { role: "user", text: finalText },
            { role: "model", text: data.response },
          ];

          // Firestore トリアージ反映
          const callId = currentCallIdRef.current;
          if (callId) {
            updateDoc(doc(getFirestoreDb(), "calls", callId), {
              要約: data.summary,
              緊急度: data.priority,
            }).catch(() => {});
          }

          // 緊急度4-5はナースが向かうので会話を終了、それ以外は継続
          if (data.priority >= 4) {
            speakAndFinish(data.response);
          } else {
            speakAndListen(data.response);
          }
        }
      } catch {
        if (mounted) {
          setAiText("通信に問題があります。少し待ってみてください。");
          setIsThinking(false);
          thinking = false;
          setTimeout(() => { if (mounted && shouldContinueConversation) startListening(); }, 2000);
        }
      }
    };

    // ── recognition イベント設定 ─────────────────────────────────
    if (recognition) {
      recognition.lang = "ja-JP";
      recognition.continuous = false;  // 1 発話ずつ区切り、デバウンスで結合
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (!mounted || !shouldContinueConversation || thinking) return;

        // 発話があったので 15 秒タイムアウトをリセット
        clearNoSpeech();
        noSpeechTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation) return;
          speakAndFinish("またお話ししましょうね。");
        }, 15_000);

        const segment = String(event.results[0][0].transcript ?? "").trim();
        if (!segment) return;

        // バッファに追記して画面に表示
        speechBuffer = (speechBuffer ? speechBuffer + "　" + segment : segment);
        setAiText(`「${speechBuffer}」`);
        setIsListening(false); // 収集中は聴取インジケータを消す

        // ── デバウンス: 2 秒間無入力で送信判断 ──────────────────
        clearDebounce();
        debounceTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation || thinking) return;

          const finalText = speechBuffer.replace(/\s+/g, "");
          speechBuffer = "";
          clearDebounce();

          // 要件2: 3 文字未満はノイズ扱い → バッファリセットして再聴取
          if (finalText.length < 3) {
            startListening();
            return;
          }

          sendToApi(finalText);
        }, 3_500);
      };

      recognition.onend = () => {
        if (!mounted || !shouldContinueConversation || thinking) return;
        // デバウンスタイマーが動いている = 発話収集中 → すぐ再起動してもっと聴く
        // デバウンスタイマーがない = 2 秒経過済み or 初回起動前 → 何もしない
        if (debounceTimer) {
          setTimeout(() => {
            if (mounted && shouldContinueConversation && !thinking && debounceTimer) {
              try { recognition.start(); } catch {}
            }
          }, 80);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === "not-allowed") {
          speakAndListen("マイクの許可が必要です。ブラウザの設定をご確認ください。");
          return;
        }
        if (mounted && !thinking && shouldContinueConversation) {
          setTimeout(() => {
            if (mounted && !thinking && shouldContinueConversation) startListening();
          }, 1_500);
        }
      };
    }

    // 最初の挨拶（800ms 後に TTS → その後 startListening()）
    setTimeout(() => speakAndListen("きよ子さん、どうしました？何かありましたか？"), 800);

    // クリーンアップ: マイクを確実に停止（要件3）
    return () => {
      mounted = false;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      synth.cancel();
      if (recognition) recognition.abort();
    };
  }, [isSuccess, sentReason]);

  // 送信ロジック
  const submitCall = async (reason: string) => {
    setIsSuccess(true);
    setSentReason(reason);
    if (reason === "お話") {
      setConversationTurn(0);
      conversationTurnRef.current = 0;
      conversationHistoryRef.current = [];
    }
    playSubmitSound(); // ✅ 送信成功の「ポーン」
    currentCallIdRef.current = null; // 前回の ID をリセット

    // トイレ・お話どちらも Firestore にログを残し、ドキュメント ID を保存する
    // （お話の場合は AI からトリアージ結果が届いたときに 要約/緊急度 フィールドを追記）
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

  const resetToMain = () => {
    window.speechSynthesis.cancel();
    currentCallIdRef.current = null;
    setConversationTurn(0);
    conversationTurnRef.current = 0;
    hasSubmittedRef.current = false; // 送信フラグをリセット
    setIsSuccess(false);
    setProgress(0);
    setTarget(null);
    setGazePoint({ x: -100, y: -100 });
    setStatusMessage("視線を検知中...");
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

      {/* 音声解除ヒント：最初のタップで自動的に消える */}
      {!audioReady && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-2 rounded-full bg-slate-700/90 px-5 py-2.5 text-sm text-slate-300 shadow-lg backdrop-blur-sm pointer-events-none animate-pulse">
          <span>🔔</span>
          <span>タップで通知音を有効化</span>
        </div>
      )}

      {/* スリープオーバーレイ（bg-black/95・再開ボタン付き） */}
      {isSleepMode && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-10 cursor-pointer"
          style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={handleWakeUp}
        >
          <span className="text-[7rem] animate-pulse select-none">💤</span>
          <p className="text-slate-400 text-3xl font-bold select-none tracking-widest">
            省電力モード
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleWakeUp(); }}
            className="mt-2 px-16 py-6 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-[2rem] font-bold rounded-full shadow-2xl border-2 border-slate-500 transition-all select-none"
          >
            タッチして再開
          </button>
        </div>
      )}

      {/* Eyedid：1〜5点キャリブレーション（SDK が注視点を指示） */}
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

      {/* 視線ハロー */}
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
        <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500 w-full h-full px-8">
          {sentReason === "トイレ" ? (
            <div className="bg-slate-800 p-24 rounded-[4rem] shadow-2xl text-center border-8 border-orange-700/60">
              <h1 className="text-[6rem] font-black text-orange-400 mb-8 leading-tight">
                みっちゃんさんに<br />伝えましたよ！
              </h1>
              <p className="text-[3rem] font-bold text-slate-300">すぐに行くから、待っててね。</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full max-w-5xl">
              <div
                className={`mb-8 px-8 py-4 rounded-full text-2xl font-bold transition-colors ${
                  isListening
                    ? "bg-red-900/50 text-red-400 border-2 border-red-700 animate-pulse"
                    : isThinking
                      ? "bg-blue-900/50 text-blue-400 border-2 border-blue-700 animate-bounce"
                      : "bg-transparent text-transparent"
                }`}
              >
                {isListening ? "🔴 声を聴いています..." : isThinking ? "🧠 考えています..." : ""}
              </div>
              <h1 className="text-[3.5rem] font-black text-blue-300 mb-16 text-center leading-snug w-full px-8 min-h-[10rem]">
                {aiText}
              </h1>
              <div className="relative w-80 h-80 flex items-center justify-center mb-20">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
                    isListening
                      ? "bg-red-900 animate-pulse scale-110"
                      : isThinking
                        ? "bg-yellow-900"
                        : "bg-blue-900 animate-[pulse_3s_ease-in-out_infinite]"
                  }`}
                />
                <div className="relative w-64 h-64 bg-gradient-to-br from-blue-900 to-slate-800 border-8 border-blue-700/60 rounded-full shadow-2xl flex items-center justify-center animate-[bounce_4s_ease-in-out_infinite]">
                  <div className="text-[5rem] text-blue-400 font-bold">AI</div>
                </div>
              </div>
              <button
                onClick={resetToMain}
                className="px-16 py-8 bg-slate-700 text-slate-200 text-[3rem] font-bold rounded-full shadow-md active:scale-95 transition-all hover:bg-slate-600"
              >
                おわる
              </button>
            </div>
          )}
        </div>
      ) : !isCalibrating ? (
        <div className="w-full h-full px-12 flex flex-col items-center justify-center">
          <div className="text-center absolute top-8 z-[10000] flex max-w-[min(100%,42rem)] flex-col items-center gap-3 px-4">
            <p
              className={`text-lg font-bold inline-block px-6 py-3 rounded-full shadow-md border-2 sm:text-2xl sm:px-8 ${
                trackingError || cameraError
                  ? "bg-red-900/90 text-red-300 border-red-700"
                  : "bg-slate-800/90 text-slate-400 border-slate-700"
              }`}
            >
              {trackingError || cameraError
                ? `⚠️ ${trackingError ?? cameraError}`
                : statusMessage}
            </p>
            {(trackingError ||
              cameraError ||
              statusMessage === "カメラを準備しています...") && (
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setStatusMessage("カメラを準備しています...");
                  setBootstrapVersion((k) => k + 1);
                }}
                className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2 rounded-full border border-slate-500 transition touch-manipulation min-h-[44px]"
              >
                📷 カメラを再起動
              </button>
            )}
          </div>

          {/* 再キャリブレーションボタン（タップ＝ユーザー操作として getUserMedia を先に通す） */}
          <button
            type="button"
            onClick={() => {
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
            }}
            className="absolute top-8 right-8 z-[10000] text-xs text-slate-400 bg-slate-800/70 border border-slate-700 px-3 py-2 rounded-full shadow touch-manipulation min-h-[40px]"
          >
            再キャリブレーション
          </button>

          <button
            type="button"
            onClick={() => setShowTuning((v) => !v)}
            className="absolute top-8 left-8 z-[10000] text-xs text-slate-400 bg-slate-800/70 border border-slate-700 px-3 py-2 rounded-full shadow touch-manipulation min-h-[40px]"
          >
            視線チューニング
          </button>

          {showTuning && (
            <div className="absolute left-8 top-20 z-[10000] w-[min(26rem,calc(100vw-4rem))] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur">
              <p className="mb-3 font-bold">誤反応を減らす調整（自動保存）</p>
              <div className="space-y-3">
                <label className="block">
                  <span>左判定の広さ: {(gazeTuning.leftThresholdRatio * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min={20}
                    max={49}
                    value={Math.round(gazeTuning.leftThresholdRatio * 100)}
                    onChange={(e) =>
                      setGazeTuning((t) =>
                        normalizeGazeTuning({ ...t, leftThresholdRatio: Number(e.target.value) / 100 }),
                      )
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span>右判定の広さ: {(gazeTuning.rightThresholdRatio * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min={51}
                    max={80}
                    value={Math.round(gazeTuning.rightThresholdRatio * 100)}
                    onChange={(e) =>
                      setGazeTuning((t) =>
                        normalizeGazeTuning({ ...t, rightThresholdRatio: Number(e.target.value) / 100 }),
                      )
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span>確定までの連続フレーム: {gazeTuning.confirmFrames}</span>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={gazeTuning.confirmFrames}
                    onChange={(e) =>
                      setGazeTuning((t) => normalizeGazeTuning({ ...t, confirmFrames: Number(e.target.value) }))
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span>見失いで解除するフレーム: {gazeTuning.releaseFrames}</span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={gazeTuning.releaseFrames}
                    onChange={(e) =>
                      setGazeTuning((t) => normalizeGazeTuning({ ...t, releaseFrames: Number(e.target.value) }))
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span>ゲージ上昇速度: +{gazeTuning.risePerTick}</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={gazeTuning.risePerTick}
                    onChange={(e) =>
                      setGazeTuning((t) => normalizeGazeTuning({ ...t, risePerTick: Number(e.target.value) }))
                    }
                    className="mt-1 w-full"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setGazeTuning(DEFAULT_GAZE_TUNING)}
                  className="rounded-full border border-slate-600 px-3 py-1"
                >
                  既定値に戻す
                </button>
                <button
                  type="button"
                  onClick={() => setShowTuning(false)}
                  className="rounded-full bg-cyan-700 px-3 py-1 text-cyan-50"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* Eyedid：まばたき・集中度（デバッグ／状態確認用） */}
          {!trackingError && (
            <div className="pointer-events-none fixed bottom-3 left-3 z-[10000] max-w-[min(100%,20rem)] rounded bg-black/55 px-2 py-1 font-mono text-[10px] text-slate-300 sm:text-xs">
              まばたき累計: {eyedidBlinkCount} / 集中度:{" "}
              {eyedidAttention != null ? eyedidAttention.toFixed(2) : "—"}
            </div>
          )}

          <div className="flex flex-row gap-8 w-full h-[70vh] max-w-7xl mx-auto mt-16 max-[640px]:flex-col max-[640px]:gap-6 max-[640px]:h-auto max-[640px]:min-h-[50vh]">
            {/* トイレボタン */}
            <div
              className={`flex-1 rounded-[4rem] border-[12px] transition-all duration-300 relative overflow-hidden flex items-center justify-center ${
                target === "トイレ"
                  ? "border-orange-500 bg-orange-950/60 scale-[1.02] shadow-[0_0_50px_rgba(249,115,22,0.25)]"
                  : "border-orange-800/50 bg-slate-800 shadow-md"
              }`}
            >
              <div
                className="absolute bottom-0 left-0 w-full bg-orange-500 opacity-25"
                style={{
                  height: `${target === "トイレ" ? progress : 0}%`,
                  transition: "height 0.1s linear",
                }}
              />
              <span className="text-[12rem] font-black text-slate-100 relative z-10 pointer-events-none">
                トイレ
              </span>
            </div>

            {/* お話ボタン */}
            <div
              className={`flex-1 rounded-[4rem] border-[12px] transition-all duration-300 relative overflow-hidden flex items-center justify-center ${
                target === "お話"
                  ? "border-blue-500 bg-blue-950/60 scale-[1.02] shadow-[0_0_50px_rgba(59,130,246,0.25)]"
                  : "border-blue-800/50 bg-slate-800 shadow-md"
              }`}
            >
              <div
                className="absolute bottom-0 left-0 w-full bg-blue-500 opacity-25"
                style={{
                  height: `${target === "お話" ? progress : 0}%`,
                  transition: "height 0.1s linear",
                }}
              />
              <span className="text-[12rem] font-black text-slate-100 relative z-10 pointer-events-none">
                お話
              </span>
            </div>
          </div>
        </div>
      ) : null}
      <ElderVideoLetterOverlay
        suppressReplayUi={isSuccess || isCalibrating || isSleepMode}
      />

      {/*
        家族・スタッフ用の画面へ（きよこ画面単体では URL を知らないと辿り着けないため）。
        送信中・会話中は誤タップ防止のため非表示。省電力中はスリープ解除後に利用。
      */}
      {!isSuccess && !isSleepMode && (
        <nav
          aria-label="スタッフ・家族向けページ"
          className="pointer-events-none fixed bottom-2 left-0 right-0 z-[10002] flex justify-center px-2"
        >
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-slate-600/60 bg-slate-900/85 px-4 py-2 text-[11px] text-slate-400 shadow-lg backdrop-blur-sm sm:text-xs">
            <Link href="/settings" className="hover:text-white">
              設定・メニュー
            </Link>
            <span className="text-slate-600" aria-hidden>
              |
            </span>
            <Link href="/dashboard" className="hover:text-white">
              記録
            </Link>
            <span className="text-slate-600" aria-hidden>
              |
            </span>
            <Link href="/dashboard/family" className="hover:text-white">
              家族
            </Link>
            <span className="text-slate-600" aria-hidden>
              |
            </span>
            <Link href="/dashboard/nurse" className="hover:text-white">
              ナース
            </Link>
            <span className="text-slate-600" aria-hidden>
              |
            </span>
            <Link href="/dashboard/history" className="hover:text-white">
              履歴
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
