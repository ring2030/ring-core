"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { buildCallWritePayload } from "@/lib/calls/schema";
import { triageFromTranscript } from "@/lib/kiyoko/triageFromTranscript";

const REASSURANCE = "The nurse team knows. You can rest easy.";

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
  u.rate = 0.95;
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
          Family faces (placeholder — swap for photos later)
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
        "Could not save to Firebase. Check .env.local and Firestore rules.",
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
      // eslint react-hooks/set-state-in-effect: defer setState out of the effect body.
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
    // eslint react-hooks/set-state-in-effect: defer setState out of the effect body.
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
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-4">
        {phase === "reassurance" ? (
          <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-2 text-center motion-safe:animate-[kiyoko-success-reveal_0.45s_ease-out_both]">
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
              Reading aloud — check your volume
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
            <FamilyFaceHero />
            <div className="w-full max-w-xl px-2 text-center">
              <p className="text-xl font-bold text-white sm:text-2xl">
                Mic on · listening
              </p>
              <p className="mt-2 text-base text-amber-100/90">
                “Pain”, “fell”, “help” → urgent · “Lonely”, “call someone” → lower urgency
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
                Done — send this
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
