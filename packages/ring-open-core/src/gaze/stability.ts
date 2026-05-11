export type TargetStabilityState<T extends string = string> = {
  locked: T | null;
  candidate: T | null;
  candidateFrames: number;
  lostFrames: number;
};

export function initialStabilityState<T extends string>(): TargetStabilityState<T> {
  return {
    locked: null,
    candidate: null,
    candidateFrames: 0,
    lostFrames: 0,
  };
}

export type StabilityOptions = {
  confirmFrames?: number;
  releaseFrames?: number;
};

/**
 * Stabilises raw gaze hits across frames to reduce accidental switches.
 */
export function stepTargetStability<T extends string>(
  prev: TargetStabilityState<T>,
  raw: T | null,
  opts: StabilityOptions = {},
): TargetStabilityState<T> {
  const confirmFrames = opts.confirmFrames ?? 4;
  const releaseFrames = opts.releaseFrames ?? 3;
  const initial = initialStabilityState<T>();

  if (raw != null && raw === prev.locked) {
    return { locked: prev.locked, candidate: null, candidateFrames: 0, lostFrames: 0 };
  }

  if (raw == null) {
    if (prev.locked == null) return initial;
    const nextLost = prev.lostFrames + 1;
    if (nextLost >= releaseFrames) return initial;
    return {
      locked: prev.locked,
      candidate: null,
      candidateFrames: 0,
      lostFrames: nextLost,
    };
  }

  const nextFrames = prev.candidate === raw ? prev.candidateFrames + 1 : 1;
  if (nextFrames >= confirmFrames) {
    return { locked: raw, candidate: null, candidateFrames: 0, lostFrames: 0 };
  }

  return {
    locked: prev.locked,
    candidate: raw,
    candidateFrames: nextFrames,
    lostFrames: 0,
  };
}
