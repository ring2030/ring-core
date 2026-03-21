"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { triageFromTranscript } from "@/lib/kiyoko/triageFromTranscript";

const REASSURANCE =
  "みっちゃんや看護師さんに伝えたよ。安心して待っててね。";

/** 無音のままこの時間でタイムアウト（空または途中までの認識で送信） */
const ABSOLUTE_LISTEN_MS = 26000;

async function saveVoiceCall(t: {
  理由: string;
  緊急度: string;
  認識文: string;
}) {
  await addDoc(collection(getFirestoreDb(), "calls"), {
    理由: t.理由,
    緊急度: t.緊急度,
    時間: serverTimestamp(),
    ステータス: "未対応",
    ...(t.認識文 ? { 認識文: t.認識文 } : {}),
  });
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const list = speechSynthesis.getVoices();
  const ja = list.filter((v) => v.lang.toLowerCase().startsWith("ja"));
  if (ja.length === 0) return null;
  const warm =
    ja.find((v) =>
      /female|女性|さとみ|kyoko|nanami|ゆかり|nozomi/i.test(v.name),
    ) ?? ja[0];
  return warm ?? null;
}

function speakReassurance() {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(REASSURANCE);
  u.lang = "ja-JP";
  u.rate = 0.92;
  u.pitch = 1.05;

  const applyVoice = () => {
    const voice = pickJapaneseVoice();
    if (voice) u.voice = voice;
  };
  applyVoice();

  const onVoices = () => applyVoice();
  speechSynthesis.addEventListener("voiceschanged", onVoices);

  const detach = () => {
    speechSynthesis.removeEventListener("voiceschanged", onVoices);
  };

  u.onend = detach;
  u.onerror = detach;
  speechSynthesis.speak(u);
}

function FamilyFaceHero() {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(72vmin,420px)] overflow-hidden rounded-full border-[6px] border-white shadow-2xl ring-4 ring-amber-200/80"
      style={{
        background:
          "linear-gradient(160deg, #fef9c3 0%, #fde047 40%, #f59e0b 85%, #b45309 100%)",
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pb-[8%]">
        <div className="flex flex-wrap items-end justify-center gap-4 px-4 sm:gap-6">
          <span
            className="text-[min(18vmin,7rem)] leading-none drop-shadow-lg"
            aria-hidden
          >
            👴
          </span>
          <span
            className="text-[min(22vmin,8.5rem)] leading-none drop-shadow-lg"
            aria-hidden
          >
            👵
          </span>
          <span
            className="text-[min(18vmin,7rem)] leading-none drop-shadow-lg"
            aria-hidden
          >
            👧
          </span>
        </div>
        <p className="mt-2 px-4 text-center text-sm font-semibold text-amber-950/75 sm:text-base">
          家族の顔（ダミー・あとから写真に差し替えできます）
        </p>
      </div>
    </div>
  );
}

type Phase = "listen" | "saving" | "reassurance" | "unsupported" | "mic_denied";

type VoiceTriageModalProps = {
  open: boolean;
  onClose: () => void;
};

export function VoiceTriageModal({ open, onClose }: VoiceTriageModalProps) {
  const [phase, setPhase] = useState<Phase>("listen");
  const [liveText, setLiveText] = useState("");
  const [errorDetail, setErrorDetail] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const processedRef = useRef(false);
  const finalBufferRef = useRef("");
  const latestTranscriptRef = useRef("");
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupRecognition = useCallback(() => {
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current);
      absoluteTimerRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  const runPipeline = useCallback(async () => {
    if (processedRef.current) return;
    processedRef.current = true;
    const transcript = latestTranscriptRef.current.trim();
    cleanupRecognition();
    setPhase("saving");
    const triage = triageFromTranscript(transcript);
    try {
      await saveVoiceCall(triage);
    } catch (e) {
      console.error(e);
      speechSynthesis.cancel();
      setErrorDetail(
        "Firebaseへの保存に失敗しました。.env.local と Firestore ルールを確認してください。",
      );
      setPhase("unsupported");
      return;
    }
    setPhase("reassurance");
    speakReassurance();
  }, [cleanupRecognition]);

  useEffect(() => {
    if (!open) {
      cleanupRecognition();
      speechSynthesis.cancel();
      processedRef.current = false;
      finalBufferRef.current = "";
      latestTranscriptRef.current = "";
      // eslint react-hooks/set-state-in-effect 対策: setState を effect 本体から非同期に逃がします。
      void Promise.resolve().then(() => {
        setPhase("listen");
        setLiveText("");
        setErrorDetail("");
      });
      return;
    }

    processedRef.current = false;
    finalBufferRef.current = "";
    latestTranscriptRef.current = "";
    // eslint react-hooks/set-state-in-effect 対策: setState を effect 本体から非同期に逃がします。
    void Promise.resolve().then(() => {
      setPhase("listen");
      setLiveText("");
      setErrorDetail("");
    });

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      void Promise.resolve().then(() => {
        setPhase("unsupported");
        setErrorDetail(
          "このブラウザでは Web Speech API（音声認識）が使えません。Chrome（PC）推奨です。",
        );
      });
      return;
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;

    absoluteTimerRef.current = setTimeout(() => {
      void runPipeline();
    }, ABSOLUTE_LISTEN_MS);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        const piece = row[0]?.transcript ?? "";
        if (row.isFinal) {
          finalBufferRef.current = `${finalBufferRef.current}${piece}`;
        } else {
          interim += piece;
        }
      }
      const combined =
        `${finalBufferRef.current}${interim}`.trim();
      latestTranscriptRef.current = combined;
      setLiveText(combined);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (processedRef.current) return;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        cleanupRecognition();
        setPhase("mic_denied");
        setErrorDetail(
          "マイクの使用が許可されていません。アドレスバーの鍵アイコンから許可してください。",
        );
        return;
      }
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      console.warn("speech recognition:", event.error);
    };

    recognition.onend = () => {
      if (processedRef.current) return;
      try {
        recognition.start();
      } catch {
        /* already running */
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      void Promise.resolve().then(() => {
        setPhase("mic_denied");
        setErrorDetail("マイクを起動できませんでした。");
      });
    }

    return () => {
      cleanupRecognition();
      speechSynthesis.cancel();
    };
  }, [open, cleanupRecognition, runPipeline]);

  const handleClose = () => {
    if (phase === "saving") return;
    cleanupRecognition();
    speechSynthesis.cancel();
    onClose();
  };

  const handleTapToFinish = () => {
    if (phase !== "listen") return;
    void runPipeline();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 motion-safe:animate-[kiyoko-backdrop-in_0.2s_ease-out_both]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
    >
      <div className="flex shrink-0 justify-end">
        <button
          type="button"
          onClick={handleClose}
          disabled={phase === "saving"}
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-40"
        >
          閉じる
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-4">
        {phase === "reassurance" ? (
          <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-2 text-center motion-safe:animate-[kiyoko-success-reveal_0.45s_ease-out_both]">
            <p
              id="voice-modal-title"
              className="text-[clamp(1.25rem,5.5vmin,2rem)] font-bold leading-snug text-amber-100"
            >
              伝えました
            </p>
            <p className="text-[clamp(1.5rem,6.5vmin,2.75rem)] font-black leading-tight tracking-tight text-white drop-shadow-lg">
              {REASSURANCE}
            </p>
            <p className="text-sm text-slate-400">
              同じ内容を音声でも読み上げています（音量をご確認ください）
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-slate-800 shadow-lg hover:bg-amber-50"
            >
              戻る
            </button>
          </div>
        ) : phase === "saving" ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <div
              className="size-16 animate-spin rounded-full border-4 border-white/20 border-t-amber-300"
              aria-hidden
            />
            <p className="text-xl font-bold">送信中…</p>
          </div>
        ) : phase === "unsupported" || phase === "mic_denied" ? (
          <div className="max-w-md px-4 text-center">
            <p
              id="voice-modal-title"
              className="text-xl font-bold text-red-200"
            >
              {phase === "mic_denied" ? "マイクを使えません" : "利用できません"}
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-200">
              {errorDetail}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 rounded-2xl bg-amber-400 px-8 py-3 font-bold text-slate-900"
            >
              戻る
            </button>
          </div>
        ) : (
          <>
            <h2 id="voice-modal-title" className="sr-only">
              音声でお話しください
            </h2>
            <FamilyFaceHero />
            <div className="w-full max-w-xl px-2 text-center">
              <p className="text-xl font-bold text-white sm:text-2xl">
                マイク ON · 聞いています
              </p>
              <p className="mt-2 text-base text-amber-100/90">
                「痛い」「転んだ」「助けて」→ 緊急：高　／　「寂しい」「呼びたい」など →
                緊急：低
              </p>
              <div
                className="mt-6 min-h-[4.5rem] rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-left text-lg leading-relaxed text-white"
                aria-live="polite"
              >
                {liveText ? (
                  liveText
                ) : (
                  <span className="text-slate-500">
                    聞き取り中…（話し終えたら下のボタンですぐ送れます）
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleTapToFinish}
                className="mt-6 w-full max-w-md rounded-2xl border-2 border-amber-300/80 bg-amber-500/20 py-4 text-lg font-bold text-amber-100 hover:bg-amber-500/30"
              >
                話し終わった（今の内容で送る）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
