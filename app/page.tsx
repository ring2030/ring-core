"use client";

import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useAudio } from "@/lib/useAudio";
import type { TriageResponse } from "@/app/api/chat/route";

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

  const resetSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setIsSleepMode(true), SLEEP_TIMEOUT_MS);
  };

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

  // 視線データ受信
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "GAZE_UPDATE") {
        setGazePoint({ x: event.data.x, y: event.data.y });
        setStatusMessage("視線を検知中...");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // gazePoint が更新されるたびにスリープタイマーをリセット
  // ただし送信中・AI会話中（isSuccess）はタイマーをクリアしてスリープさせない
  useEffect(() => {
    if (isSuccess) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      return;
    }
    resetSleepTimer();
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gazePoint, isSuccess]);

  // スリープ解除：タッチ時にオーバーレイを消してタイマーを再開
  const handleWakeUp = () => {
    setIsSleepMode(false);
    resetSleepTimer();
  };

  // 当たり判定（左右）— 150ms ごとに評価してリレンダーを抑制
  const gazeRef = useRef(gazePoint);
  gazeRef.current = gazePoint;
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

  // 激甘ゲージ
  useEffect(() => {
    if (isSuccess || isCalibrating || isSleepMode) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (target) {
          const next = prev + 10;
          if (next >= 100) {
            submitCall(target);
            return 100;
          }
          return next;
        } else {
          return Math.max(0, prev - 1);
        }
      });
    }, 100);
    return () => clearInterval(interval);
  }, [target, isSuccess, isCalibrating, isSleepMode]);

  // AI会話システム
  useEffect(() => {
    if (!isSuccess || sentReason !== "お話") return;

    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SR ? new SR() : null;
    const synth = window.speechSynthesis;
    let mounted = true;
    let thinking = false;
    let resultReceived = false;
    let errorCount = 0;
    const MAX_ERRORS = 2;

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
          synth.addEventListener("voiceschanged", () => resolve(pick(synth.getVoices())), {
            once: true,
          });
        }
      });

    const speakAndListen = async (text: string) => {
      if (!mounted) return;
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = 0.9;
      utter.pitch = 1.1;
      utter.voice = await getJpVoice();

      utter.onend = () => {
        if (recognition && mounted) startListening();
      };

      synth.cancel();
      synth.speak(utter);
    };

    const startListening = () => {
      if (!mounted || thinking || !recognition) return;
      resultReceived = false;
      setAiText("（話しかけてください...）");
      setIsListening(true);
      try {
        recognition.start();
      } catch {
        // すでに起動中の場合は無視
      }
    };

    if (recognition) {
      recognition.lang = "ja-JP";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = async (event: any) => {
        // ─── 排他ロック: API 送信中は新しい音声入力を無視（429 防止） ───
        if (thinking) return;

        resultReceived = true;
        errorCount = 0;
        const said = event.results[0][0].transcript;
        thinking = true;
        setIsThinking(true);
        setIsListening(false);
        setAiText(`「${said}」...`);

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: said }),
          });

          if (!res.ok) {
            errorCount++;
            if (mounted) {
              if (errorCount >= MAX_ERRORS) {
                setAiText("少し調子が悪いです。ボタンを押して呼んでね。");
                setIsThinking(false);
                thinking = false;
              } else {
                setAiText("うまく聞き取れませんでした。もう一度話しかけてください。");
                setIsThinking(false);
                thinking = false;
                setTimeout(() => { if (mounted && !thinking) startListening(); }, 2000);
              }
            }
            return;
          }

          const data: TriageResponse = await res.json();
          if (mounted) {
            errorCount = 0;

            // ─── トリアージ結果を Firestore ドキュメントへ反映 ───────────
            const callId = currentCallIdRef.current;
            if (callId) {
              updateDoc(doc(getFirestoreDb(), "calls", callId), {
                要約: data.summary,
                緊急度: data.priority,
              }).catch(() => {}); // 失敗してもAI会話は止めない
            }

            speakAndListen(data.response);
          }
        } catch {
          errorCount++;
          if (mounted) {
            setAiText("通信に問題があります。少し待ってみてください。");
            setIsThinking(false);
            thinking = false;
          }
        }
      };

      recognition.onend = () => {
        if (!resultReceived && mounted && !thinking) {
          setTimeout(() => {
            if (mounted && !thinking) startListening();
          }, 800);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          speakAndListen("マイクの許可が必要です。ブラウザの設定をご確認ください。");
          return;
        }
        if (mounted && !thinking) {
          setTimeout(() => {
            if (mounted && !thinking) startListening();
          }, 1500);
        }
      };
    }

    setTimeout(() => speakAndListen("きよ子さん、どうしました？何かありましたか？"), 800);

    return () => {
      mounted = false;
      synth.cancel();
      if (recognition) recognition.abort();
    };
  }, [isSuccess, sentReason]);

  // 送信ロジック
  const submitCall = async (reason: string) => {
    setIsSuccess(true);
    setSentReason(reason);
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
