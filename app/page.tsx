"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useAudio } from "@/lib/useAudio";

// API ルートから import type すると Next.js のサーバー/クライアント境界を越えるため
// 型だけここで定義する
interface TriageResponse {
  response: string;
  summary:  string;
  priority: number;
}

const CAL_POINTS = [
  { rx: 0.1, ry: 0.12 },
  { rx: 0.9, ry: 0.12 },
  { rx: 0.5, ry: 0.5 },
  { rx: 0.1, ry: 0.88 },
  { rx: 0.9, ry: 0.88 },
];
const CAL_TS_KEY = "kiyoko_cal_ts";
const CAL_TTL_MS = 24 * 60 * 60 * 1000;
const SLEEP_TIMEOUT_MS = 10_000;

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

  // キャリブレーション
  const [isCalibrating, setIsCalibrating] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [calStep, setCalStep] = useState(0);

  // スリープモード
  const [isSleepMode, setIsSleepMode] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // トリアージ: Firestore に書いたドキュメント ID を保持（AI応答後に更新するため）
  const currentCallIdRef = useRef<string | null>(null);

  // 通知音（ブラウザの自動再生制限に対応）
  const { audioReady, playSubmitSound } = useAudio();

  // isSuccess / isCalibrating の最新値をクロージャから安全に読むための ref
  const isSuccessRef = useRef(false);
  isSuccessRef.current = isSuccess;
  const isCalibrationRef = useRef(true);
  isCalibrationRef.current = isCalibrating;

  // gazePoint スロットル用（~25fps に間引き、無限ループ防止）
  const lastGazeUpdateRef = useRef(0);

  // スリープタイマーリセット（useEffect に依存しない安定した関数）
  // refs だけ使うので deps は空 → 毎レンダーで再生成されない
  const resetSleepTimer = useCallback(() => {
    // 送信中・AI会話中・キャリブレーション中はスリープさせない
    if (isSuccessRef.current || isCalibrationRef.current) return;
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setIsSleepMode(true), SLEEP_TIMEOUT_MS);
  }, []);

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

  // 初回起動時：24時間以内にキャリブレーション済みならスキップ
  useEffect(() => {
    const ts = localStorage.getItem(CAL_TS_KEY);
    if (ts && Date.now() - parseInt(ts) < CAL_TTL_MS) {
      setIsCalibrating(false);
    }
  }, []);

  // 視線データ受信 ＋ スリープタイマーリセット
  // ・~25fps にスロットルして setState の連打を防止（Maximum update depth 対策）
  // ・タイマーリセットはここで直接行い、useEffect([gazePoint]) の連鎖を排除
  useEffect(() => {
    const THROTTLE_MS = 16; // iframe 側が 100ms に絞るので受信側は緩めに（滑らかさ優先）
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type !== "GAZE_UPDATE") return;
      const now = Date.now();
      if (now - lastGazeUpdateRef.current < THROTTLE_MS) return; // 間引き
      lastGazeUpdateRef.current = now;
      setGazePoint({ x: event.data.x, y: event.data.y });
      setStatusMessage("視線を検知中...");
      resetSleepTimer(); // ← useEffect 依存ではなく直接リセット
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [resetSleepTimer]);

  // ページ表示直後にもタイマーを開始（gaze が来る前にスリープさせるため）
  useEffect(() => {
    resetSleepTimer();
    return () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); };
  }, [resetSleepTimer]);

  // isSuccess が true（送信中/AI会話中）になったらタイマーを即クリア
  useEffect(() => {
    if (isSuccess && sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  }, [isSuccess]);

  // isSleepMode 変化時に WebGazer の ML 推論を pause/resume（CPU 省電力）
  useEffect(() => {
    const msg = isSleepMode ? { type: "SLEEP" } : { type: "WAKE" };
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, [isSleepMode]);

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
  // 二重送信防止フラグ
  const hasSubmittedRef = useRef(false);
  const conversationTurnRef = useRef(0);
  conversationTurnRef.current = conversationTurn;
  useEffect(() => {
    if (isSuccess || isCalibrating || isSleepMode) return;
    const id = setInterval(() => {
      const { x, y } = gazeRef.current;
      if (x < 0) return;
      let hit: "トイレ" | "お話" | null = null;
      if (y > windowHeight * 0.1) {
        if (x < windowWidth * 0.45) hit = "トイレ";
        else if (x > windowWidth * 0.55) hit = "お話";
      }
      setTarget((prev) => (prev === hit ? prev : hit));
    }, 150);
    return () => clearInterval(id);
  }, [isSuccess, isCalibrating, isSleepMode, windowWidth, windowHeight]);

  // 激甘ゲージ（updater は純粋に数値だけ更新。submitCall はここで呼ばない）
  useEffect(() => {
    if (isSuccess || isCalibrating || isSleepMode) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (target) return Math.min(prev + 10, 100);
        return Math.max(0, prev - 1);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [target, isSuccess, isCalibrating, isSleepMode]);

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

    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SR ? new SR() : null;
    const synth = window.speechSynthesis;

    // ── ローカル変数 ──────────────────────────────────────────────
    let mounted = true;
    let shouldContinueConversation = true;
    let thinking = false;
    let speechBuffer = "";                                          // デバウンス用テキストバッファ
    let debounceTimer: ReturnType<typeof setTimeout> | null = null; // 2 秒待機タイマー
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
        // TTS 音声がスピーカーから消えてから認識開始（自分の声を拾わないように500ms待機）
        if (mounted && shouldContinueConversation) {
          setTimeout(() => { if (mounted && shouldContinueConversation) startListening(); }, 500);
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

      // 3 ターン上限
      if (conversationTurnRef.current >= 3) {
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
          body: JSON.stringify({ message: finalText }),
        });
        const data: TriageResponse = await res.json();
        if (mounted) {
          // Firestore トリアージ反映
          const callId = currentCallIdRef.current;
          if (callId) {
            updateDoc(doc(getFirestoreDb(), "calls", callId), {
              要約: data.summary,
              緊急度: data.priority,
            }).catch(() => {});
          }
          speakAndListen(data.response); // ← ここで thinking=false になり再聴取へ
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

      recognition.onresult = (event: any) => {
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
        }, 2_000);
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

      recognition.onerror = (event: any) => {
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
    } catch (err) {}

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

  // キャリブレーション点をクリック
  const handleCalDotClick = () => {
    const pt = CAL_POINTS[calStep];
    const x = pt.rx * window.innerWidth;
    const y = pt.ry * windowHeight;

    for (let i = 0; i < 5; i++) {
      iframeRef.current?.contentWindow?.postMessage({ type: "CALIBRATE", x, y }, "*");
    }

    const next = calStep + 1;
    if (next >= CAL_POINTS.length) {
      localStorage.setItem(CAL_TS_KEY, Date.now().toString());
      setIsCalibrating(false);
    } else {
      setCalStep(next);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-900 font-sans overflow-hidden select-none flex flex-col items-center justify-center">

      {/* 音声解除ヒント：最初のタップで自動的に消える */}
      {!audioReady && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-2 rounded-full bg-slate-700/90 px-5 py-2.5 text-sm text-slate-300 shadow-lg backdrop-blur-sm pointer-events-none animate-pulse">
          <span>🔔</span>
          <span>タップで通知音を有効化</span>
        </div>
      )}

      {/*
        iframe を画面全体に広げる（透明）。
        スリープ中は visibility:hidden で処理を軽減する。
      */}
      <iframe
        ref={iframeRef}
        src="/gaze-core.html"
        allow="camera"
        className="fixed inset-0 w-full h-full border-0 pointer-events-none"
        style={{
          opacity: 0,
          zIndex: 0,
          visibility: isSleepMode ? "hidden" : "visible",
        }}
      />

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

      {/* キャリブレーション画面 */}
      {isCalibrating && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-slate-100 mb-2">視線の教育</p>
          <p className="text-lg text-cyan-400 mb-1">
            この点を<strong>見ながら</strong>タップしてください — {calStep + 1} / {CAL_POINTS.length}
          </p>
          <p className="text-sm text-slate-500 mb-12">各点をタップするたびに精度が上がります</p>

          <button
            type="button"
            onClick={handleCalDotClick}
            className="fixed -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-4 border-cyan-400 bg-white/10 flex items-center justify-center shadow-[0_0_30px_10px_rgba(34,211,238,0.4)] active:scale-95 transition"
            style={{
              left: CAL_POINTS[calStep].rx * windowWidth,
              top: CAL_POINTS[calStep].ry * windowHeight,
            }}
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>

          <div className="fixed bottom-10 left-0 right-0 flex justify-center gap-3">
            {CAL_POINTS.map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full transition-all duration-300 ${
                  i < calStep ? "bg-cyan-400" : i === calStep ? "scale-125 bg-white" : "bg-slate-600"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCalibrating(false)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm text-slate-500 underline"
          >
            スキップ（精度が下がります）
          </button>
        </div>
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
          <div className="text-center absolute top-8 z-[10000]">
            <p className="text-2xl font-bold text-slate-400 bg-slate-800/90 inline-block px-8 py-3 rounded-full shadow-md border-2 border-slate-700">
              {statusMessage}
            </p>
          </div>

          {/* 再キャリブレーションボタン */}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(CAL_TS_KEY);
              setCalStep(0);
              setIsCalibrating(true);
            }}
            className="absolute top-8 right-8 z-[10000] text-xs text-slate-400 bg-slate-800/70 border border-slate-700 px-3 py-2 rounded-full shadow"
          >
            再キャリブレーション
          </button>

          <div className="flex flex-row gap-16 w-full h-[70vh] max-w-7xl mx-auto mt-16">
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
    </div>
  );
}
