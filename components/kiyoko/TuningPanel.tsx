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
};

export function TuningPanel({ gazeTuning, onTuningChange, onClose }: Props) {
  return (
    <div className="absolute left-8 top-20 z-[10000] w-[min(26rem,calc(100vw-4rem))] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur">
      <p className="mb-3 font-bold">誤反応を減らす調整（自動保存）</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {TUNING_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onTuningChange(normalizeGazeTuning(p.value))}
            className="rounded-full border border-slate-600 px-3 py-1 text-[11px] hover:bg-slate-800"
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <label className="block">
          <span>左判定の広さ: {(gazeTuning.leftThresholdRatio * 100).toFixed(0)}%</span>
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
        <label className="block">
          <span>右判定の広さ: {(gazeTuning.rightThresholdRatio * 100).toFixed(0)}%</span>
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
        <label className="block">
          <span>確定までの連続フレーム: {gazeTuning.confirmFrames}</span>
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
        <label className="block">
          <span>見失いで解除するフレーム: {gazeTuning.releaseFrames}</span>
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
        <label className="block">
          <span>ゲージ上昇速度: +{gazeTuning.risePerTick}</span>
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
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onTuningChange(DEFAULT_GAZE_TUNING)}
          className="rounded-full border border-slate-600 px-3 py-1"
        >
          既定値に戻す
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-cyan-700 px-3 py-1 text-cyan-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
