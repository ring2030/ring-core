"use client";

import { useCallback, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { buildCallWritePayload } from "@/lib/calls/schema";
import { REASON_RESTROOM } from "@/lib/calls/reasons";
import { GazeHoverSurface } from "@/components/kiyoko/GazeHoverSurface";
import { VoiceTriageModal } from "@/components/kiyoko/VoiceTriageModal";

async function saveToiletCall() {
  await addDoc(
    collection(getFirestoreDb(), "calls"),
    buildCallWritePayload({
      reasons: [REASON_RESTROOM],
      note: "Sent from simple screen",
      senderName: "Kiyoko",
      senderRole: "patient",
      priority: 4,
    }),
  );
}

export default function KiyokoNurseCallPage() {
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [toiletSending, setToiletSending] = useState(false);
  const [toiletSuccess, setToiletSuccess] = useState(false);
  const [toiletError, setToiletError] = useState<string | null>(null);

  const handleToilet = useCallback(async () => {
    if (toiletSending || toiletSuccess) return;
    setToiletSending(true);
    setToiletError(null);
    try {
      await saveToiletCall();
      setToiletSuccess(true);
      window.setTimeout(() => setToiletSuccess(false), 2800);
    } catch (e) {
      console.error(e);
      setToiletError(
        "Could not save to Firebase. Check .env.local and Firestore rules.",
      );
    } finally {
      setToiletSending(false);
    }
  }, [toiletSending, toiletSuccess]);

  const openVoiceModal = useCallback(() => {
    setVoiceModalOpen(true);
  }, []);

  return (
    <div className="min-h-dvh bg-slate-100 font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm backdrop-blur">
        <h1 className="text-lg font-bold tracking-wide text-slate-800 sm:text-xl">
          Kiyoko — nurse call
        </h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Hold your gaze for 2 seconds (keep the cursor still) to confirm
        </p>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-5.5rem)] max-w-[1400px] grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-2">
        <GazeHoverSurface
          aria-label="Restroom call. Hold for 2 seconds to send as restroom, medium urgency."
          disabled={toiletSending || toiletSuccess}
          onActivate={handleToilet}
          ringColor="rgba(255,255,255,0.92)"
          className={`flex min-h-[42vh] flex-col rounded-3xl border-2 border-sky-200/80 shadow-xl transition-[transform,box-shadow] lg:min-h-[calc(100dvh-8rem)] ${
            toiletSuccess
              ? "bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 shadow-sky-300/50 ring-4 ring-emerald-300 ring-offset-4"
              : "bg-gradient-to-br from-sky-200 via-sky-300 to-blue-400 hover:shadow-2xl"
          }`}
        >
          {toiletSuccess && (
            <div
              className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-sky-500/25 backdrop-blur-[2px] motion-safe:animate-[kiyoko-success-reveal_0.35s_ease-out_both]"
              aria-live="polite"
            >
              <div className="mb-3 flex size-24 items-center justify-center rounded-full bg-white shadow-lg">
                <svg
                  className="size-14 text-emerald-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-white drop-shadow-md">
                Sent
              </p>
              <p className="mt-1 text-sm font-medium text-white/90">
                Reason: Restroom · Priority: medium
              </p>
            </div>
          )}
          <span className="text-[clamp(2.5rem,12vmin,5.5rem)] font-black leading-none tracking-tight text-sky-950/90">
            Restroom 🚽
          </span>
          <span className="mt-4 max-w-[90%] text-center text-base font-semibold text-sky-950/75 sm:text-lg">
            Usual call
          </span>
        </GazeHoverSurface>

        <GazeHoverSurface
          aria-label="Talk. Hold for 2 seconds to open voice and family video."
          disabled={voiceModalOpen}
          onActivate={openVoiceModal}
          ringColor="rgba(255,255,255,0.88)"
          className="flex min-h-[42vh] flex-col rounded-3xl border-2 border-rose-300/90 bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-600 shadow-xl transition-shadow hover:shadow-2xl lg:min-h-[calc(100dvh-8rem)]"
        >
          <span className="text-[clamp(2.5rem,14vmin,6.5rem)] font-black leading-none tracking-tight text-white drop-shadow-md">
            Hey
          </span>
          <span className="mt-5 max-w-[92%] text-center text-base font-semibold leading-relaxed text-rose-50 sm:text-lg">
            Talk (voice)
          </span>
          <span className="mt-2 text-center text-sm text-rose-100/90">
            Mic → triage → send with priority
          </span>
        </GazeHoverSurface>
      </div>

      {toiletError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 max-w-sm w-[calc(100%-2rem)] rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
        >
          {toiletError}
          <button
            type="button"
            onClick={() => setToiletError(null)}
            className="ml-3 font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <VoiceTriageModal
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
      />
    </div>
  );
}
