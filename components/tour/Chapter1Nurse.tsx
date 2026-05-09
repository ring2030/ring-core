"use client";

import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState } from "react";
import { CHAPTERS } from "@/lib/tour/schedule";

const CHAPTER_DURATION = CHAPTERS[1]!.durationSec;

const PIE_SLICES = [
  { label: "Chat / story", percent: 38, color: "#f43f5e" },
  { label: "Restroom", percent: 27, color: "#06b6d4" },
  { label: "Medication", percent: 18, color: "#a855f7" },
  { label: "Pain / discomfort", percent: 11, color: "#f59e0b" },
  { label: "Other", percent: 6, color: "#64748b" },
];

const STARTING_CALLS = [
  { time: "22:08", name: "佐藤 清子", reason: "Chatting about her late husband", priority: 5 },
  { time: "21:52", name: "山田 太郎", reason: "Restroom · already comforted by AI", priority: 4 },
  { time: "21:31", name: "中村 ふみ", reason: "Cannot sleep — wants someone to talk to", priority: 5 },
  { time: "20:58", name: "佐藤 清子", reason: "Asked AI about tomorrow's breakfast", priority: 5 },
];

const NEW_CALL = {
  time: "22:14",
  name: "田中 花子",
  reason: "Patient unsure if medication was taken",
  priority: 3,
};

interface Props {
  /** Wall-clock seconds elapsed inside this chapter (resets on chapter enter). */
  elapsedSec: number;
}

export function Chapter1Nurse({ elapsedSec }: Props) {
  const reducedMotion = useReducedMotion();

  // Drive the 74% number with a spring that constantly drifts ±0.1%.
  const target = useMotionValue(73.8);
  const spring = useSpring(target, { stiffness: 60, damping: 18, mass: 0.5 });
  const [displayed, setDisplayed] = useState("73.8%");
  useMotionValueEvent(spring, "change", (v) => {
    setDisplayed(`${v.toFixed(1)}%`);
  });

  useEffect(() => {
    if (reducedMotion) {
      target.set(74.0);
      return;
    }
    if (elapsedSec >= 3 && elapsedSec < 4) target.set(74.1);
    else if (elapsedSec >= 4) {
      const drift = 74 + Math.sin(elapsedSec * 0.9) * 0.1;
      target.set(drift);
    } else target.set(73.8);
  }, [elapsedSec, target, reducedMotion]);

  // New call appears 3s into the chapter.
  const showNewCall = elapsedSec >= 3;
  const showCaption = elapsedSec >= 4 && elapsedSec < CHAPTER_DURATION - 4;
  const countdownLeft = Math.max(0, Math.ceil(CHAPTER_DURATION - elapsedSec));
  const showCountdown = countdownLeft > 0 && countdownLeft <= 3;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black px-4 py-6 text-white">
      {/* Mini scene-setter pinned to top-right */}
      <div className="absolute right-4 top-4 z-20 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-rose-300/30">
        You are: Y. Yamada, RN lead
      </div>

      <div
        aria-live="polite"
        className="relative w-full max-w-6xl rounded-2xl bg-slate-900/95 p-5 shadow-2xl ring-1 ring-white/10 sm:p-7"
        style={{ width: "min(95vw, 1100px)" }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">
              Care dashboard <span className="text-white/50">(nurse)</span>
            </div>
            <div className="hidden text-xs text-white/50 sm:block">·</div>
            <div className="text-xs text-white/60">Y. Yamada, RN lead</div>
          </div>
          <div className="text-xs text-white/60">22:14, Wed</div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            primary={displayed}
            label="Calls comforted by AI"
            accent="rose"
            highlight={elapsedSec >= 3 && elapsedSec < 8}
          />
          <KpiTile primary="31" label="Fewer visits / mo" accent="cyan" />
          <KpiTile primary="155m" label="Staff time saved / mo" accent="amber" />
        </div>

        {/* Pie + Call list */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <CategoryDonut />
          <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-white/10">
            <div className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-white/50">
              Live call queue
            </div>
            <ul className="space-y-1.5">
              {showNewCall && (
                <motion.li
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }}
                  className="flex items-center justify-between gap-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm ring-1 ring-rose-300/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-rose-200">{NEW_CALL.time}</span>
                    <span className="font-medium text-white">{NEW_CALL.name}</span>
                    <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-100">
                      Priority {NEW_CALL.priority}
                    </span>
                  </div>
                  <span className="truncate text-white/80">{NEW_CALL.reason}</span>
                </motion.li>
              )}
              {STARTING_CALLS.map((c) => (
                <li
                  key={c.time + c.name}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-white/50">{c.time}</span>
                    <span className="font-medium text-white">{c.name}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/70">
                      P{c.priority}
                    </span>
                  </div>
                  <span className="truncate text-white/60">{c.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Caption */}
        <div className="mt-5 h-12">
          {showCaption && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center text-sm text-rose-200 sm:text-base"
            >
              This number — <span className="font-semibold">74%</span> — recalculates from real
              calls every minute. <span className="text-white/70">It&rsquo;s not a slide.</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Countdown overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        {showCountdown && (
          <motion.div
            key={countdownLeft}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 ring-1 ring-white/20"
          >
            Next: Family view in {countdownLeft}…
          </motion.div>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  primary,
  label,
  accent,
  highlight = false,
}: {
  primary: React.ReactNode;
  label: string;
  accent: "rose" | "cyan" | "amber";
  highlight?: boolean;
}) {
  const tones: Record<string, string> = {
    rose: "from-rose-500/20 to-rose-500/5 ring-rose-300/30 text-rose-50",
    cyan: "from-cyan-500/20 to-cyan-500/5 ring-cyan-300/30 text-cyan-50",
    amber: "from-amber-500/20 to-amber-500/5 ring-amber-300/30 text-amber-50",
  };
  return (
    <motion.div
      animate={highlight ? { boxShadow: "0 0 24px rgba(244,63,94,0.35)" } : { boxShadow: "0 0 0 rgba(0,0,0,0)" }}
      transition={{ duration: 0.6 }}
      className={`rounded-xl bg-gradient-to-br p-4 ring-1 ${tones[accent]}`}
    >
      <div className="text-3xl font-bold tabular-nums sm:text-4xl">{primary}</div>
      <div className="mt-1 text-xs text-white/70 sm:text-sm">{label}</div>
    </motion.div>
  );
}

function CategoryDonut() {
  const radius = 70;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  const sliceLengths = PIE_SLICES.map((s) => (circumference * s.percent) / 100);
  const sliceOffsets = sliceLengths.reduce<number[]>((acc, len, i) => {
    acc.push(i === 0 ? 0 : (acc[i - 1] ?? 0) + (sliceLengths[i - 1] ?? 0));
    return acc;
  }, []);
  return (
    <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-white/10">
      <div className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-white/50">
        Last 7 days · category mix
      </div>
      <div className="flex items-center gap-3">
        <svg width={radius * 2 + stroke} height={radius * 2 + stroke} viewBox={`0 0 ${radius * 2 + stroke} ${radius * 2 + stroke}`} aria-hidden>
          <g transform={`translate(${radius + stroke / 2}, ${radius + stroke / 2}) rotate(-90)`}>
            {PIE_SLICES.map((s, i) => {
              const len = sliceLengths[i] ?? 0;
              const off = sliceOffsets[i] ?? 0;
              const dasharray = `${len} ${circumference - len}`;
              return (
                <circle
                  key={s.label}
                  r={radius}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={dasharray}
                  strokeDashoffset={-off}
                />
              );
            })}
          </g>
        </svg>
        <ul className="space-y-1 text-xs">
          {PIE_SLICES.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-white/75">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className="ml-1 text-white/50">{s.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Chapter1Nurse;
