"use client";

import { memo } from "react";

type TargetButtonProps = {
  label: "トイレ" | "お話";
  isActive: boolean;
  progress: number;
  colors: {
    activeBorder: string;
    activeBg: string;
    activeShadow: string;
    inactiveBorder: string;
    progressBg: string;
  };
};

function TargetButton({ label, isActive, progress, colors }: TargetButtonProps) {
  return (
    <div
      className={`flex-1 rounded-[4rem] border-[12px] transition-all duration-300 relative overflow-hidden flex items-center justify-center ${
        isActive
          ? `${colors.activeBorder} ${colors.activeBg} scale-[1.02] ${colors.activeShadow}`
          : `${colors.inactiveBorder} bg-slate-800 shadow-md`
      }`}
    >
      <div
        className={`absolute bottom-0 left-0 w-full ${colors.progressBg} opacity-25`}
        style={{
          height: `${isActive ? progress : 0}%`,
          transition: "height 0.1s linear",
        }}
      />
      <span className="text-[12rem] font-black text-slate-100 relative z-10 pointer-events-none">
        {label}
      </span>
    </div>
  );
}

const TOILET_COLORS = {
  activeBorder: "border-orange-500",
  activeBg: "bg-orange-950/60",
  activeShadow: "shadow-[0_0_50px_rgba(249,115,22,0.25)]",
  inactiveBorder: "border-orange-800/50",
  progressBg: "bg-orange-500",
};

const TALK_COLORS = {
  activeBorder: "border-blue-500",
  activeBg: "bg-blue-950/60",
  activeShadow: "shadow-[0_0_50px_rgba(59,130,246,0.25)]",
  inactiveBorder: "border-blue-800/50",
  progressBg: "bg-blue-500",
};

type Props = {
  target: "トイレ" | "お話" | null;
  progress: number;
};

export const GazeTargetPanel = memo(function GazeTargetPanel({ target, progress }: Props) {
  return (
    <div className="flex flex-row gap-8 w-full h-[70vh] max-w-7xl mx-auto mt-16 max-[640px]:flex-col max-[640px]:gap-6 max-[640px]:h-auto max-[640px]:min-h-[50vh]">
      <TargetButton label="トイレ" isActive={target === "トイレ"} progress={progress} colors={TOILET_COLORS} />
      <TargetButton label="お話" isActive={target === "お話"} progress={progress} colors={TALK_COLORS} />
    </div>
  );
});
