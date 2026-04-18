"use client";

import { memo } from "react";
import { REASON_CHAT, REASON_RESTROOM, type BinaryGazeReason } from "@/lib/calls/reasons";

type TargetButtonProps = {
  label: string;
  sublabel: string;
  isActive: boolean;
  progress: number;
  colors: {
    activeBorder: string;
    activeBg: string;
    activeShadow: string;
    inactiveBorder: string;
    progressBg: string;
    sublabel: string;
  };
};

function TargetButton({ label, sublabel, isActive, progress, colors }: TargetButtonProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] border-[8px] transition-all duration-300 sm:rounded-[3rem] sm:border-[10px] ${
        isActive
          ? `${colors.activeBorder} ${colors.activeBg} scale-[1.02] ${colors.activeShadow}`
          : `${colors.inactiveBorder} bg-slate-900/90 shadow-inner`
      }`}
    >
      {/* Progress fill from bottom */}
      <div
        className={`absolute bottom-0 left-0 w-full ${colors.progressBg} opacity-30`}
        style={{
          height: `${isActive ? progress : 0}%`,
          transition: "height 0.1s linear",
        }}
      />

      {/*
        Font size: clamp(2.5rem, 9vmin, 6rem).
        At 1080p: 9vmin = 97px → capped to 6rem = 96px.
        "Restroom" (8 chars) at 96px ≈ 476px, fits in ~508px inner panel width.
        This is as large as we can go for English without overflowing.
      */}
      <span className="relative z-10 text-center font-black leading-none tracking-tight text-slate-50 text-[clamp(2.5rem,9vmin,6rem)]">
        {label}
      </span>

      <span
        className={`relative z-10 mt-4 max-w-[88%] text-center font-semibold leading-snug ${colors.sublabel} text-[clamp(1rem,2.8vmin,1.5rem)]`}
      >
        {sublabel}
      </span>
    </div>
  );
}

const TOILET_COLORS = {
  activeBorder: "border-orange-400/90",
  activeBg: "bg-orange-950/55",
  activeShadow: "shadow-[0_0_80px_rgba(251,146,60,0.2)]",
  inactiveBorder: "border-orange-900/40",
  progressBg: "bg-orange-500",
  sublabel: "text-orange-200/85",
};

const TALK_COLORS = {
  activeBorder: "border-sky-400/90",
  activeBg: "bg-sky-950/50",
  activeShadow: "shadow-[0_0_80px_rgba(56,189,248,0.2)]",
  inactiveBorder: "border-sky-900/40",
  progressBg: "bg-sky-500",
  sublabel: "text-sky-200/85",
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
        sublabel="Look here to call"
        isActive={target === REASON_RESTROOM}
        progress={progress}
        colors={TOILET_COLORS}
      />
      <TargetButton
        label={REASON_CHAT}
        sublabel="Look here to talk"
        isActive={target === REASON_CHAT}
        progress={progress}
        colors={TALK_COLORS}
      />
    </div>
  );
});
