"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Heart, Video } from "lucide-react";
import { useMemo } from "react";

const FULL_TEXT =
  "Today: 3 calls, all peaceful.\nThe AI listened to her share memories of your grandfather.\nShe mentioned wanting to see your photos again.";

const TIMELINE = [
  { time: "22:14", emoji: "💊", label: "Medication check (your call before)" },
  { time: "19:30", emoji: "🚻", label: "Restroom" },
  { time: "15:45", emoji: "💬", label: "Sharing memories with AI" },
];

interface Props {
  elapsedSec: number;
}

export function Chapter2Family({ elapsedSec }: Props) {
  const reducedMotion = useReducedMotion();

  // Typewriter: ~30ms / char (full text ~120 chars → ~3.6s; we cap to 6s).
  const charsPerSec = reducedMotion ? FULL_TEXT.length : 30;
  const typed = useMemo(() => {
    const target = Math.min(FULL_TEXT.length, Math.floor(elapsedSec * charsPerSec));
    return FULL_TEXT.slice(0, target);
  }, [elapsedSec, charsPerSec]);

  const typingDone = typed.length >= FULL_TEXT.length;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-950 via-rose-950/30 to-slate-950 px-4 py-6 text-white">
      {/* Scene-setter, top-right */}
      <div className="absolute right-4 top-4 z-20 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100 ring-1 ring-cyan-300/30">
        You are: 花子&rsquo;s granddaughter — ~700&nbsp;km apart (Tokyo ↔ Shimane)
      </div>

      <div
        aria-live="polite"
        className="relative w-full max-w-2xl rounded-2xl bg-white/[0.04] p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:p-8"
      >
        <div className="flex items-center gap-2 text-rose-300">
          <Heart className="h-5 w-5" fill="currentColor" />
          <h2 className="text-lg font-semibold sm:text-xl">Today&rsquo;s update from your grandmother</h2>
        </div>

        <div className="mt-4 rounded-xl bg-rose-500/10 p-5 ring-1 ring-rose-300/20">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-rose-200/80">
            <Sparkles className="h-3.5 w-3.5" />
            AI summary
          </div>
          <p className="min-h-[5.5rem] whitespace-pre-line text-base leading-relaxed text-rose-50 sm:text-lg">
            {typed}
            {!typingDone && (
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="ml-0.5 inline-block w-[2px] -translate-y-0.5 align-middle"
              >
                ▎
              </motion.span>
            )}
          </p>
        </div>

        <button
          type="button"
          disabled
          aria-disabled
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/90 px-4 py-3 font-semibold text-white shadow-lg ring-1 ring-rose-300/40 transition hover:bg-rose-500"
        >
          <Video className="h-5 w-5" />
          Send a video letter
        </button>

        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">
            Today&rsquo;s timeline
          </div>
          <ul className="space-y-1.5">
            {TIMELINE.map((row) => (
              <li
                key={row.time}
                className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white/85"
              >
                <span className="text-base">{row.emoji}</span>
                <span className="font-mono text-xs text-white/60">{row.time}</span>
                <span>·</span>
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Caption appears after typewriter finishes */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
        {typingDone && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center text-sm text-rose-200/90 sm:text-base"
          >
            The same data. Now it&rsquo;s a story for someone who loves her.
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default Chapter2Family;
