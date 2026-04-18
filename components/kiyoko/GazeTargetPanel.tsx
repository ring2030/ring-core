"use client";

import { memo } from "react";
import { REASON_CHAT, REASON_RESTROOM, type BinaryGazeReason } from "@/lib/calls/reasons";

type TargetButtonProps = {
  label: BinaryGazeReason;
  emoji: string;
  subtitle: string;
  isActive: boolean;
  progress: number;
  colors: {
    activeBorder: string;
    activeBg: string;
    activeShadow: string;
    inactiveBorder: string;
    progressBg: string;
    subtitle: string;
    ring: string;
  };
};

function TargetButton({ label, emoji, subtitle, isActive, progress, colors }: TargetButtonProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[2rem] border-[8px] transition-all duration-300 sm:gap-5 sm:rounded-[3rem] sm:border-[10px] ${
        isActive
          ? `${colors.activeBorder} ${colors.activeBg} scale-[1.02] ${colors.activeShadow} ${colors.ring}`
          : `${colors.inactiveBorder} bg-slate-900/90 shadow-inner`
      }`}
    >
      {/* Progress fill from bottom */}
      <div
        className={`absolute bottom-0 left-0 w-full ${colors.progressBg} opacity-25`}
        style={{
          height: `${isActive ? progress : 0}%`,
          transition: "height 0.1s linear",
        }}
      />

      {/* Glow ring when active */}
      {isActive && (
        <div
          className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2.5rem] ${colors.progressBg} opacity-10 animate-pulse`}
        />
      )}

      {/* Primary: large emoji */}
      <span
        className="relative z-10 select-none leading-none text-[clamp(4.5rem,18vmin,10rem)]"
        role="img"
        aria-label={label}
      >
        {emoji}
      </span>

      {/* Secondary: text label — controlled size, no overflow */}
      <span className="relative z-10 font-black leading-none tracking-tight text-slate-50 text-[clamp(1.5rem,5vmin,3rem)]">
        {label}
      </span>

      {/* Tertiary: subtitle */}
      <span
        className={`relative z-10 max-w-[82%] text-center font-semibold leading-snug ${colors.subtitle} text-[clamp(0.75rem,2vmin,1.1rem)]`}
      >
        {subtitle}
      </span>

      {/* Progress arc indicator */}
      {isActive && progress > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <svg width="48" height="6" viewBox="0 0 48 6" aria-hidden>
            <rect x="0" y="1" width="48" height="4" rx="2" fill="rgba(255,255,255,0.15)" />
            <rect
              x="0"
              y="1"
              width={`${(progress / 100) * 48}`}
              height="4"
              rx="2"
              className={`${colors.progressBg} opacity-80`}
              fill="currentColor"
              style={{ transition: "width 0.1s linear" }}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

const TOILET_COLORS = {
  activeBorder: "border-orange-400/90",
  activeBg: "bg-orange-950/55",
  activeShadow: "shadow-[0_0_80px_rgba(251,146,60,0.25)]",
  inactiveBorder: "border-orange-900/40",
  progressBg: "bg-orange-500",
  subtitle: "text-orange-200/80",
  ring: "ring-2 ring-orange-400/30 ring-offset-2 ring-offset-transparent",
};

const TALK_COLORS = {
  activeBorder: "border-sky-400/90",
  activeBg: "bg-sky-950/50",
  activeShadow: "shadow-[0_0_80px_rgba(56,189,248,0.25)]",
  inactiveBorder: "border-sky-900/40",
  progressBg: "bg-sky-500",
  subtitle: "text-sky-200/80",
  ring: "ring-2 ring-sky-400/30 ring-offset-2 ring-offset-transparent",
};

type Props = {
  target: BinaryGazeReason | null;
  progress: number;
};

export const GazeTargetPanel = memo(function GazeTargetPanel({ target, progress }: Props) {
  return (
    <div className="mx-auto mt-2 flex min-h-[min(68vh,480px)] w-full max-w-6xl flex-row gap-4 max-[640px]:min-h-[52vh] max-[640px]:flex-col max-[640px]:gap-4 sm:mt-4 sm:min-h-[65vh] sm:gap-6 sm:max-w-7xl">
      <TargetButton
        label={REASON_RESTROOM}
        emoji="🚽"
        subtitle="Look here to call for help"
        isActive={target === REASON_RESTROOM}
        progress={progress}
        colors={TOILET_COLORS}
      />
      <TargetButton
        label={REASON_CHAT}
        emoji="💬"
        subtitle="Look here to start talking"
        isActive={target === REASON_CHAT}
        progress={progress}
        colors={TALK_COLORS}
      />
    </div>
  );
});
