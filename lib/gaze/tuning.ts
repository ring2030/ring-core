export type GazeTuning = {
  leftThresholdRatio: number;
  rightThresholdRatio: number;
  confirmFrames: number;
  releaseFrames: number;
  risePerTick: number;
  fallPerTick: number;
};

export const GAZE_TUNING_KEY = "kiyoko_gaze_tuning_v1";

export const DEFAULT_GAZE_TUNING: GazeTuning = {
  leftThresholdRatio: 0.43,
  rightThresholdRatio: 0.57,
  confirmFrames: 4,
  releaseFrames: 3,
  risePerTick: 3,
  fallPerTick: 1,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeGazeTuning(input: Partial<GazeTuning>): GazeTuning {
  return {
    leftThresholdRatio: clamp(Number(input.leftThresholdRatio ?? DEFAULT_GAZE_TUNING.leftThresholdRatio), 0.2, 0.49),
    rightThresholdRatio: clamp(Number(input.rightThresholdRatio ?? DEFAULT_GAZE_TUNING.rightThresholdRatio), 0.51, 0.8),
    confirmFrames: Math.round(clamp(Number(input.confirmFrames ?? DEFAULT_GAZE_TUNING.confirmFrames), 2, 10)),
    releaseFrames: Math.round(clamp(Number(input.releaseFrames ?? DEFAULT_GAZE_TUNING.releaseFrames), 1, 8)),
    risePerTick: Math.round(clamp(Number(input.risePerTick ?? DEFAULT_GAZE_TUNING.risePerTick), 1, 10)),
    fallPerTick: Math.round(clamp(Number(input.fallPerTick ?? DEFAULT_GAZE_TUNING.fallPerTick), 1, 5)),
  };
}

export function loadGazeTuning(): GazeTuning {
  if (typeof window === "undefined") return DEFAULT_GAZE_TUNING;
  try {
    const raw = localStorage.getItem(GAZE_TUNING_KEY);
    if (!raw) return DEFAULT_GAZE_TUNING;
    const parsed = JSON.parse(raw) as Partial<GazeTuning>;
    return normalizeGazeTuning(parsed);
  } catch {
    return DEFAULT_GAZE_TUNING;
  }
}

export function saveGazeTuning(tuning: GazeTuning): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GAZE_TUNING_KEY, JSON.stringify(tuning));
  } catch {
    // ignore
  }
}

export const TUNING_PRESETS: Array<{ name: string; value: GazeTuning }> = [
  {
    name: "安定重視",
    value: {
      leftThresholdRatio: 0.4,
      rightThresholdRatio: 0.6,
      confirmFrames: 6,
      releaseFrames: 4,
      risePerTick: 2,
      fallPerTick: 1,
    },
  },
  {
    name: "標準",
    value: DEFAULT_GAZE_TUNING,
  },
  {
    name: "反応重視",
    value: {
      leftThresholdRatio: 0.45,
      rightThresholdRatio: 0.55,
      confirmFrames: 3,
      releaseFrames: 2,
      risePerTick: 4,
      fallPerTick: 1,
    },
  },
];
