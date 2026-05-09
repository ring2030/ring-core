"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { buildCallWritePayload } from "@/lib/calls/schema";
import { triageFromTranscript } from "@/lib/kiyoko/triageFromTranscript";

const REASSURANCE = "The nurse team has been notified. You are safe. Please relax.";

/** Silence timeout: if no usable speech, still submit partial or empty transcript. */
const ABSOLUTE_LISTEN_MS = 26000;

async function saveVoiceCall(t: { reason: string; urgency: "high" | "low"; transcript: string }) {
  const priority = t.urgency === "high" ? 4 : 2;
  await addDoc(
    collection(getFirestoreDb(), "calls"),
    buildCallWritePayload({
      reasons: [t.reason],
      note: "",
      senderName: "Kiyoko",
      senderRole: "patient",
      priority,
      transcript: t.transcript,
    }),
  );
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speakReassurance() {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(REASSURANCE);
  u.lang = "en-US";
  u.rate = 0.88;
  u.pitch = 1.0;
  u.volume = 1.0;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.lang === "en-US" && /zira|aria|samantha|jenny|emma/i.test(v.name))
    ?? voices.find((v) => v.lang === "en-US")
    ?? voices.find((v) => v.lang.startsWith("en"));
  if (preferred) u.voice = preferred;
  speechSynthesis.speak(u);
}

type HeroMode = "listening" | "speaking" | "reassurance";
type CompanionTone = "calm" | "supportive" | "urgent";

function FamilyFaceHero({ mode, tone }: { mode: HeroMode; tone: CompanionTone }) {
  const familyPhotoUrl = process.env["NEXT_PUBLIC_FAMILY_PHOTO_URL"]?.trim();
  const isSpeaking = mode === "speaking";
  const isListening = mode === "listening";
  const isReassurance = mode === "reassurance";
  const toneOverlay =
    tone === "urgent"
      ? "bg-red-100/16"
      : tone === "calm"
        ? "bg-cyan-100/14"
        : "bg-amber-100/16";
  const toneRing =
    tone === "urgent"
      ? "ring-red-200/80"
      : tone === "calm"
        ? "ring-cyan-200/80"
        : "ring-amber-200/80";

  return (
    <div
      className={`relative mx-auto aspect-square w-full max-w-[min(72vmin,420px)] overflow-hidden rounded-full border-[6px] border-white shadow-2xl ring-4 ${toneRing}`}
      style={{
        background:
          "linear-gradient(160deg, #fef9c3 0%, #fde047 40%, #f59e0b 85%, #b45309 100%)",
      }}
    >
      {familyPhotoUrl && (
        <Image
          src={familyPhotoUrl}
          alt="Family photo"
          fill
          sizes="(max-width: 768px) 72vmin, 420px"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isReassurance ? "opacity-85" : "opacity-65"
          }`}
        />
      )}
      <div className={`absolute inset-0 ${toneOverlay}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pb-[8%]">
        <div className="flex flex-wrap items-end justify-center gap-4 px-4 sm:gap-6">
          <span
            className={`text-[min(20vmin,8rem)] leading-none drop-shadow-lg ${
              isListening ? "motion-safe:animate-[kiyoko-bob_1.2s_ease-in-out_infinite]" : ""
            }`}
            aria-hidden
          >
            👴
          </span>
          <span
            className={`text-[min(25vmin,10rem)] leading-none drop-shadow-lg ${
              isSpeaking
                ? "motion-safe:animate-[kiyoko-talk_0.24s_ease-in-out_infinite]"
                : isReassurance
                  ? "motion-safe:animate-[kiyoko-pulse_0.9s_ease-in-out_infinite]"
                  : ""
            }`}
            aria-hidden
          >
            👵
          </span>
          <span
            className={`text-[min(20vmin,8rem)] leading-none drop-shadow-lg ${
              isListening ? "motion-safe:animate-[kiyoko-bob_1.2s_ease-in-out_infinite_0.15s]" : ""
            }`}
            aria-hidden
          >
            👧
          </span>
        </div>
        <p className="mt-2 px-4 text-center text-sm font-semibold text-amber-950/75 sm:text-base">
          {familyPhotoUrl
            ? "Family photo with supportive animation"
            : "Family faces (set NEXT_PUBLIC_FAMILY_PHOTO_URL to use a real photo)"}
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
  const [companionTone, setCompanionTone] = useState<CompanionTone>("supportive");

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

  const inferCompanionTone = useCallback((transcript: string, urgency: "high" | "low"): CompanionTone => {
    if (urgency === "high") return "urgent";
    if (/lonely|anxious|scared|寁E不安|こわ/i.test(transcript)) return "supportive";
    return "calm";
  }, []);

  const runPipeline = useCallback(async () => {
    if (processedRef.current) return;
    processedRef.current = true;
    const transcript = latestTranscriptRef.current.trim();
    cleanupRecognition();
    setPhase("saving");
    const triage = triageFromTranscript(transcript);
    setCompanionTone(inferCompanionTone(transcript, triage.urgency));
    try {
      await saveVoiceCall(triage);
    } catch (e) {
      console.error(e);
      speechSynthesis.cancel();
      setErrorDetail(
        "Could not save to Firebase. Check .env.local and Firestore rules.",
      );
      setPhase("unsupported");
      return;
    }
    setPhase("reassurance");
    speakReassurance();
  }, [cleanupRecognition, inferCompanionTone]);

  useEffect(() => {
    if (!open) {
      cleanupRecognition();
      speechSynthesis.cancel();
      processedRef.current = false;
      finalBufferRef.current = "";
      latestTranscriptRef.current = "";
      // eslint react-hooks/set-state-in-effect: defer setState out of the effect body.
      void Promise.resolve().then(() => {
        setPhase("listen");
        setLiveText("");
        setErrorDetail("");
        setCompanionTone("supportive");
      });
      return;
    }

    processedRef.current = false;
    finalBufferRef.current = "";
    latestTranscriptRef.current = "";
    // eslint react-hooks/set-state-in-effect: defer setState out of the effect body.
    void Promise.resolve().then(() => {
      setPhase("listen");
      setLiveText("");
      setErrorDetail("");
      setCompanionTone("supportive");
    });

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      void Promise.resolve().then(() => {
        setPhase("unsupported");
        setErrorDetail(
          "This browser does not support speech recognition. Try Chrome on desktop.",
        );
      });
      return;
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    absoluteTimerRef.current = setTimeout(() => {
      void runPipeline();
    }, ABSOLUTE_LISTEN_MS);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        if (!row) continue;
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
          "Microphone access denied. Allow it from the lock icon in the address bar.",
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
        setErrorDetail("Could not start the microphone.");
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

  const toneBadge =
    companionTone === "urgent"
      ? { label: "Urgent support mode", cls: "border-red-200 bg-red-50 text-red-700" }
      : companionTone === "calm"
        ? { label: "Calm companion mode", cls: "border-cyan-200 bg-cyan-50 text-cyan-700" }
        : { label: "Empathy companion mode", cls: "border-amber-200 bg-amber-50 text-amber-800" };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 motion-safe:animate-[kiyoko-backdrop-in_0.2s_ease-out_both]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
    >
      <style>{`
        @keyframes kiyoko-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px) scale(1.06); }
        }
        @keyframes kiyoko-talk {
          0%, 100% { transform: scale(1) translateY(0) rotate(0deg); }
          25% { transform: scale(1.12, 0.88) translateY(2px) rotate(-1deg); }
          50% { transform: scale(0.9, 1.14) translateY(-2px) rotate(1deg); }
          75% { transform: scale(1.1, 0.9) translateY(1px) rotate(-1deg); }
        }
        @keyframes kiyoko-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.09); filter: brightness(1.08); }
        }
        @keyframes kiyoko-ring {
          0% { transform: scale(0.86); opacity: 0.7; }
          100% { transform: scale(1.24); opacity: 0; }
        }
      `}</style>
      <div className="flex shrink-0 justify-end">
        <button
          type="button"
          onClick={handleClose}
          disabled={phase === "saving"}
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-40"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-4">
        {phase === "reassurance" ? (
          <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-2 text-center motion-safe:animate-[kiyoko-success-reveal_0.45s_ease-out_both]">
            <FamilyFaceHero mode="reassurance" tone={companionTone} />
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneBadge.cls}`}>
              {toneBadge.label}
            </span>
            <p
              id="voice-modal-title"
              className="text-[clamp(1.25rem,5.5vmin,2rem)] font-bold leading-snug text-amber-100"
            >
              Sent
            </p>
            <p className="text-[clamp(1.5rem,6.5vmin,2.75rem)] font-black leading-tight tracking-tight text-white drop-shadow-lg">
              {REASSURANCE}
            </p>
            <p className="text-sm text-slate-400">
              Reading aloud  Echeck your volume
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-slate-800 shadow-lg hover:bg-amber-50"
            >
              Back
            </button>
          </div>
        ) : phase === "saving" ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <FamilyFaceHero mode="speaking" tone={companionTone} />
            <div
              className="size-16 animate-spin rounded-full border-4 border-white/20 border-t-amber-300"
              aria-hidden
            />
            <p className="text-xl font-bold">Sending…</p>
          </div>
        ) : phase === "unsupported" || phase === "mic_denied" ? (
          <div className="max-w-md px-4 text-center">
            <p
              id="voice-modal-title"
              className="text-xl font-bold text-red-200"
            >
              {phase === "mic_denied" ? "Microphone blocked" : "Not supported"}
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-200">
              {errorDetail}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 rounded-2xl bg-amber-400 px-8 py-3 font-bold text-slate-900"
            >
              Back
            </button>
          </div>
        ) : (
          <>
            <h2 id="voice-modal-title" className="sr-only">
              Speak to send
            </h2>
            <div className="relative">
              <span
                className={`pointer-events-none absolute inset-0 rounded-full border-4 motion-safe:animate-[kiyoko-ring_1.1s_ease-out_infinite] ${
                  companionTone === "urgent"
                    ? "border-red-200/70"
                    : companionTone === "calm"
                      ? "border-cyan-200/70"
                      : "border-amber-200/70"
                }`}
              />
              <span
                className={`pointer-events-none absolute inset-0 rounded-full border-4 motion-safe:animate-[kiyoko-ring_1.1s_ease-out_infinite_0.35s] ${
                  companionTone === "urgent"
                    ? "border-red-200/50"
                    : companionTone === "calm"
                      ? "border-cyan-200/50"
                      : "border-amber-200/50"
                }`}
              />
              <FamilyFaceHero mode={liveText ? "speaking" : "listening"} tone={companionTone} />
            </div>
            <div className="w-full max-w-xl px-2 text-center">
              <div className="mb-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneBadge.cls}`}>
                  {toneBadge.label}
                </span>
              </div>
              <p className="text-xl font-bold text-white sm:text-2xl">
                Mic on · listening
              </p>
              <p className="mt-2 text-base text-amber-100/90">
                “Pain E “fell E “help EↁEurgent · “Lonely E “call someone EↁElower urgency
              </p>
              <div
                className="mt-6 min-h-[4.5rem] rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-left text-lg leading-relaxed text-white"
                aria-live="polite"
              >
                {liveText ? (
                  liveText
                ) : (
                  <span className="text-slate-500">
                    Listening… tap the button below when you’re done
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleTapToFinish}
                className="mt-6 w-full max-w-md rounded-2xl border-2 border-amber-300/80 bg-amber-500/20 py-4 text-lg font-bold text-amber-100 hover:bg-amber-500/30"
              >
                Done  Esend this
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
