"use client";

import { memo } from "react";

type TargetButtonProps = {
  label: "トイレ" | "お話";
  subtitle?: string;
  isActive: boolean;
  progress: number;
  colors: {
    activeBorder: string;
    activeBg: string;
    activeShadow: string;
    inactiveBorder: string;
    progressBg: string;
    subtitle: string;
  };
};

function TargetButton({ label, subtitle, isActive, progress, colors }: TargetButtonProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] border-[8px] transition-all duration-300 sm:rounded-[3rem] sm:border-[10px] ${
        isActive
          ? `${colors.activeBorder} ${colors.activeBg} scale-[1.02] ${colors.activeShadow}`
          : `${colors.inactiveBorder} bg-slate-900/90 shadow-inner`
      }`}
    >
      <div
        className={`absolute bottom-0 left-0 w-full ${colors.progressBg} opacity-30`}
        style={{
          height: `${isActive ? progress : 0}%`,
          transition: "height 0.1s linear",
        }}
      />
      <span className="relative z-10 max-w-[95%] text-center text-[clamp(4rem,18vmin,11rem)] font-black leading-none tracking-tight text-slate-50">
        {label}
      </span>
      {subtitle ? (
        <span
          className={`relative z-10 mt-3 max-w-[90%] text-center text-[clamp(0.95rem,2.8vmin,1.35rem)] font-semibold ${colors.subtitle}`}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

const TOILET_COLORS = {
  activeBorder: "border-orange-400/90",
  activeBg: "bg-orange-950/55",
  activeShadow: "shadow-[0_0_60px_rgba(251,146,60,0.2)]",
  inactiveBorder: "border-orange-900/40",
  progressBg: "bg-orange-500",
  subtitle: "text-orange-200/85",
};

const TALK_COLORS = {
  activeBorder: "border-sky-400/90",
  activeBg: "bg-sky-950/50",
  activeShadow: "shadow-[0_0_60px_rgba(56,189,248,0.2)]",
  inactiveBorder: "border-sky-900/40",
  progressBg: "bg-sky-500",
  subtitle: "text-sky-200/85",
};

type Props = {
  target: "トイレ" | "お話" | null;
  progress: number;
};

export const GazeTargetPanel = memo(function GazeTargetPanel({ target, progress }: Props) {
  return (
    <div className="mx-auto mt-2 flex min-h-[min(68vh,480px)] w-full max-w-6xl flex-row gap-4 max-[640px]:min-h-[52vh] max-[640px]:flex-col max-[640px]:gap-4 sm:mt-4 sm:min-h-[65vh] sm:gap-6 sm:max-w-7xl">
      <TargetButton
        label="トイレ"
        isActive={target === "トイレ"}
        progress={progress}
        colors={TOILET_COLORS}
      />
      <TargetButton
        label="お話"
        subtitle="はなしたいとき"
        isActive={target === "お話"}
        progress={progress}
        colors={TALK_COLORS}
      />
    </div>
  );
});
