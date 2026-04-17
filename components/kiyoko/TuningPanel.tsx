"use client";

import {
  DEFAULT_GAZE_TUNING,
  normalizeGazeTuning,
  TUNING_PRESETS,
  type GazeTuning,
} from "@/lib/gaze/tuning";

type Props = {
  gazeTuning: GazeTuning;
  onTuningChange: (tuning: GazeTuning) => void;
  onClose: () => void;
  /** When true, embed in settings (no fixed overlay positioning). */
  embedded?: boolean;
};

export function TuningPanel({ gazeTuning, onTuningChange, onClose, embedded }: Props) {
  const box = embedded
    ? "w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm"
    : "absolute left-8 top-20 z-[10000] w-[min(26rem,calc(100vw-4rem))] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur";

  return (
    <div className={box}>
      <p
        className={`mb-3 font-bold ${embedded ? "text-slate-900" : "text-slate-100"}`}
      >
        Reduce false triggers (auto-saved)
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {TUNING_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onTuningChange(normalizeGazeTuning(p.value))}
            className={
              embedded
                ? "rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[11px] hover:bg-slate-100"
                : "rounded-full border border-slate-600 px-3 py-1 text-[11px] hover:bg-slate-800"
            }
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <label className={`block ${embedded ? "text-slate-700" : ""}`}>
          <span>Left zone width: {(gazeTuning.leftThresholdRatio * 100).toFixed(0)}%</span>
          <input
            type="range"
            min={20}
            max={49}
            value={Math.round(gazeTuning.leftThresholdRatio * 100)}
            onChange={(e) =>
              onTuningChange(
                normalizeGazeTuning({ ...gazeTuning, leftThresholdRatio: Number(e.target.value) / 100 }),
              )
            }
            className="mt-1 w-full"
          />
        </label>
        <label className={`block ${embedded ? "text-slate-700" : ""}`}>
          <span>Right zone width: {(gazeTuning.rightThresholdRatio * 100).toFixed(0)}%</span>
          <input
            type="range"
            min={51}
            max={80}
            value={Math.round(gazeTuning.rightThresholdRatio * 100)}
            onChange={(e) =>
              onTuningChange(
                normalizeGazeTuning({ ...gazeTuning, rightThresholdRatio: Number(e.target.value) / 100 }),
              )
            }
            className="mt-1 w-full"
          />
        </label>
        <label className={`block ${embedded ? "text-slate-700" : ""}`}>
          <span>Frames to confirm: {gazeTuning.confirmFrames}</span>
          <input
            type="range"
            min={2}
            max={10}
            value={gazeTuning.confirmFrames}
            onChange={(e) =>
              onTuningChange(normalizeGazeTuning({ ...gazeTuning, confirmFrames: Number(e.target.value) }))
            }
            className="mt-1 w-full"
          />
        </label>
        <label className={`block ${embedded ? "text-slate-700" : ""}`}>
          <span>Frames to release when lost: {gazeTuning.releaseFrames}</span>
          <input
            type="range"
            min={1}
            max={8}
            value={gazeTuning.releaseFrames}
            onChange={(e) =>
              onTuningChange(normalizeGazeTuning({ ...gazeTuning, releaseFrames: Number(e.target.value) }))
            }
            className="mt-1 w-full"
          />
        </label>
        <label className={`block ${embedded ? "text-slate-700" : ""}`}>
          <span>Gauge rise per tick: +{gazeTuning.risePerTick}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={gazeTuning.risePerTick}
            onChange={(e) =>
              onTuningChange(normalizeGazeTuning({ ...gazeTuning, risePerTick: Number(e.target.value) }))
            }
            className="mt-1 w-full"
          />
        </label>
      </div>
      <div
        className={`mt-4 flex items-center ${embedded ? "justify-start" : "justify-between"}`}
      >
        <button
          type="button"
          onClick={() => onTuningChange(DEFAULT_GAZE_TUNING)}
          className={
            embedded
              ? "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              : "rounded-full border border-slate-600 px-3 py-1"
          }
        >
          Reset to defaults
        </button>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-cyan-700 px-3 py-1 text-cyan-50"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
