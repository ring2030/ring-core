"use client";

import { memo } from "react";
import type { GazeTarget, TargetStabilityState } from "@/lib/gaze/selection";

type Props = {
  blinkCount: number;
  attentionScore: number | null;
  trackingState: number | null;
  debugRawHit: GazeTarget;
  stability: TargetStabilityState;
  confirmFrames: number;
};

export const GazeDebugOverlay = memo(function GazeDebugOverlay({
  blinkCount,
  attentionScore,
  trackingState,
  debugRawHit,
  stability,
  confirmFrames,
}: Props) {
  return (
    <>
      <div className="pointer-events-none fixed bottom-3 left-3 z-[10000] max-w-[min(100%,20rem)] rounded bg-black/55 px-2 py-1 font-mono text-[10px] text-slate-300 sm:text-xs">
        Blinks: {blinkCount} / focus:{" "}
        {attentionScore != null ? attentionScore.toFixed(2) : "—"} / state:{" "}
        {trackingState === 0
          ? "SUCCESS"
          : trackingState === 1
            ? "LOW_CONF"
            : trackingState === 3
              ? "FACE_MISS"
              : trackingState ?? "—"}
      </div>
      <div className="pointer-events-none fixed bottom-16 left-3 z-[10000] max-w-[min(100%,24rem)] rounded bg-black/55 px-2 py-1 font-mono text-[10px] text-cyan-200 sm:text-xs">
        raw={String(debugRawHit)} lock={String(stability.locked)} cand={String(stability.candidate)} frames={stability.candidateFrames}/{confirmFrames}
      </div>
    </>
  );
});
