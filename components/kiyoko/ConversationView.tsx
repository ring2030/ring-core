"use client";

import { Mic, Sparkles } from "lucide-react";

type Props = {
  aiText: string;
  isListening: boolean;
  isThinking: boolean;
  onEnd: () => void;
};

export function ConversationView({ aiText, isListening, isThinking, onEnd }: Props) {
  const phase = isListening ? "listen" : isThinking ? "think" : "speak";
  const mouthClass =
    phase === "speak"
      ? "animate-[kiyoko-avatar-talk_0.7s_ease-in-out_infinite]"
      : phase === "think"
        ? "animate-pulse"
        : "";

  return (
    <div className="flex h-full w-full animate-in zoom-in flex-col items-center justify-center duration-500">
      <div className="flex w-full max-w-5xl flex-col items-center px-6">
        <div
          className={`mb-6 flex items-center gap-2 rounded-full border px-5 py-2 text-base font-semibold transition-colors sm:text-lg ${
            phase === "listen"
              ? "border-rose-500/50 bg-rose-950/50 text-rose-200"
              : phase === "think"
                ? "border-sky-500/50 bg-sky-950/50 text-sky-200"
                : "border-transparent bg-transparent text-transparent"
          }`}
          aria-live="polite"
        >
          {phase === "listen" && (
            <>
              <Mic className="size-5 shrink-0 text-rose-300" strokeWidth={2} aria-hidden />
              Listening
            </>
          )}
          {phase === "think" && (
            <>
              <Sparkles className="size-5 shrink-0 text-sky-300" strokeWidth={2} aria-hidden />
              Thinking
            </>
          )}
        </div>
        <h1 className="mb-12 min-h-[8rem] w-full px-4 text-center text-[clamp(1.75rem,6vmin,3.5rem)] font-black leading-snug text-slate-100">
          {aiText}
        </h1>
        <div className="relative mb-16 flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
          <div
            className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
              phase === "listen"
                ? "scale-110 bg-rose-900/80 animate-pulse"
                : phase === "think"
                  ? "bg-amber-900/70"
                  : "animate-[pulse_3s_ease-in-out_infinite] bg-blue-900/60"
            }`}
          />
          <div className="relative flex h-56 w-56 items-center justify-center rounded-full border-8 border-blue-600/45 bg-gradient-to-br from-slate-800 to-slate-950 shadow-2xl sm:h-64 sm:w-64">
            <div className="relative h-36 w-36 sm:h-40 sm:w-40" aria-hidden>
              <div className="absolute left-5 top-8 h-6 w-6 rounded-full bg-cyan-200" />
              <div className="absolute right-5 top-8 h-6 w-6 rounded-full bg-cyan-200" />
              <div className="absolute left-7 top-10 h-2.5 w-2.5 rounded-full bg-slate-900" />
              <div className="absolute right-7 top-10 h-2.5 w-2.5 rounded-full bg-slate-900" />
              <div
                className={`absolute left-1/2 top-[4.9rem] h-3 w-14 -translate-x-1/2 rounded-full bg-cyan-300/90 sm:top-[5.25rem] ${mouthClass}`}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-[56px] rounded-full bg-slate-700 px-14 py-4 text-2xl font-bold text-slate-100 shadow-lg transition hover:bg-slate-600 active:scale-[0.98]"
        >
          End
        </button>
      </div>
    </div>
  );
}
