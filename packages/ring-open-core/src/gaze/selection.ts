/**
 * Maps a gaze point to one of two string targets with a central dead zone.
 * Pure geometry — no UI strings baked in.
 */
export type DichotomySelectParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Value returned when gaze is left of the dead zone. */
  leftTarget: string;
  /** Value returned when gaze is right of the dead zone. */
  rightTarget: string;
  leftThresholdRatio?: number;
  rightThresholdRatio?: number;
  /** Top strip (0–1 of height) treated as inactive. Default 0.1 */
  activeTopRatio?: number;
};

export function selectDichotomyTarget({
  x,
  y,
  width,
  height,
  leftTarget,
  rightTarget,
  leftThresholdRatio = 0.43,
  rightThresholdRatio = 0.57,
  activeTopRatio = 0.1,
}: DichotomySelectParams): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0) return null;

  const activeTop = height * activeTopRatio;
  if (y <= activeTop) return null;

  const leftThreshold = width * leftThresholdRatio;
  const rightThreshold = width * rightThresholdRatio;

  if (x < leftThreshold) return leftTarget;
  if (x > rightThreshold) return rightTarget;
  return null;
}

/**
 * Progress for a dwell gauge (0–100). Caller integrates time → calls with elapsed in [0, thresholdMs].
 */
export function dwellProgress(elapsedMs: number, thresholdMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    return 0;
  }
  return Math.min(100, (Math.max(0, elapsedMs) / thresholdMs) * 100);
}

export function dwellComplete(elapsedMs: number, thresholdMs: number): boolean {
  return dwellProgress(elapsedMs, thresholdMs) >= 100;
}

/**
 * Target hold gauge: rises when focused, falls when not.
 */
export function computeNextProgress(
  prev: number,
  hasTarget: boolean,
  risePerTick = 3,
  fallPerTick = 1,
): number {
  if (hasTarget) return Math.min(prev + risePerTick, 100);
  return Math.max(prev - fallPerTick, 0);
}
