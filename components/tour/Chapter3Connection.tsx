"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Heart, Mic, Smartphone, Video } from "lucide-react";

interface Moment {
  time: string;
  place: string;
  who: string;
  Icon: typeof Mic;
  accent: "rose" | "cyan" | "amber";
  action: string;
  detail: string;
}

const MOMENTS: Moment[] = [
  {
    time: "15:45",
    place: "Shimane",
    who: "Grandma",
    Icon: Mic,
    accent: "rose",
    action: "Shared memories with the AI",
    detail: "About the day she met your grandfather.",
  },
  {
    time: "21:30",
    place: "Tokyo",
    who: "You",
    Icon: Smartphone,
    accent: "cyan",
    action: "Read her story over dinner",
    detail: "“She wants to see your photos again.”",
  },
  {
    time: "23:08",
    place: "Tokyo → Shimane",
    who: "You",
    Icon: Video,
    accent: "amber",
    action: "Sent her a 90-second video letter",
    detail: "Old wedding photos. Tomorrow’s lunch plans.",
  },
];

interface Props {
  /** Seconds elapsed inside this chapter. */
  elapsedSec: number;
}

export function Chapter3Connection({ elapsedSec }: Props) {
  const reducedMotion = useReducedMotion();

  // Card reveals: 1s header pause, then one card every 3 seconds.
  const visibleCount = elapsedSec < 1 ? 0 : Math.min(3, Math.floor((elapsedSec - 1) / 3) + 1);
  const showFinal = elapsedSec >= 10;

  return (
    <div
      aria-live="polite"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-rose-950/25 to-slate-950 px-4 py-6 text-white"
    >
      {/* Soft glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[70%] w-[70%] rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5 }}
        className="relative z-10 text-center text-3xl font-light text-rose-100 sm:text-5xl"
      >
        Closer than <span className="font-semibold text-white">700&nbsp;km</span>.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reducedMotion ? 0 : 0.4, duration: 0.5 }}
        className="relative z-10 mt-2 max-w-xl text-center text-sm text-white/70 sm:text-base"
      >
        Every call becomes a story — and every story brings her family closer.
      </motion.p>

      {/* 3 timeline cards */}
      <div className="relative z-10 mt-8 grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {MOMENTS.map((m, i) => (
          <MomentCard
            key={m.time}
            moment={m}
            visible={visibleCount > i}
            reducedMotion={!!reducedMotion}
            isLast={i === MOMENTS.length - 1}
          />
        ))}
      </div>

      {/* Final reveal */}
      <div className="relative z-10 mt-8 h-24 text-center">
        {showFinal && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.6 }}
          >
            <div className="text-2xl font-light text-white sm:text-4xl">
              You were here{" "}
              <span className="font-semibold text-rose-300">three times</span> today.
            </div>
            <div className="mt-2 text-sm text-white/70 sm:text-base">
              Without a single phone call. From 700&nbsp;km away.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MomentCard({
  moment,
  visible,
  reducedMotion,
  isLast,
}: {
  moment: Moment;
  visible: boolean;
  reducedMotion: boolean;
  isLast: boolean;
}) {
  const accents: Record<Moment["accent"], string> = {
    rose: "ring-rose-300/30 bg-rose-500/10 text-rose-200",
    cyan: "ring-cyan-300/30 bg-cyan-500/10 text-cyan-200",
    amber: "ring-amber-300/30 bg-amber-500/10 text-amber-200",
  };
  const Icon = moment.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 16,
        scale: visible ? 1 : 0.96,
      }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
      className="relative rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-white/55">
        <span>{moment.time}</span>
        <span>{moment.place}</span>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ring-1 ${accents[moment.accent]}`}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
            {moment.who}
          </div>
          <div className="mt-1 text-sm font-medium text-white sm:text-base">
            {moment.action}
          </div>
          <div className="mt-1 text-xs italic leading-snug text-white/65 sm:text-sm">
            {moment.detail}
          </div>
        </div>
      </div>
      {!isLast && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-22px] top-1/2 hidden h-px w-10 -translate-y-1/2 bg-gradient-to-r from-white/30 to-transparent sm:block"
        >
          <Heart
            className="absolute -top-2 right-0 h-3 w-3 text-rose-300"
            fill="currentColor"
          />
        </div>
      )}
    </motion.div>
  );
}

export default Chapter3Connection;
