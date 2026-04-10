export type GazeTarget = "トイレ" | "お話" | null;

type SelectParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  leftThresholdRatio?: number;
  rightThresholdRatio?: number;
};

/**
 * 視線座標から左右ターゲットを判定する。
 * 中央にデッドゾーンを作り、誤反応を抑える。
 */
export function selectGazeTarget({
  x,
  y,
  width,
  height,
  leftThresholdRatio = 0.43,
  rightThresholdRatio = 0.57,
}: SelectParams): GazeTarget {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0) return null;

  const activeTop = height * 0.1;
  if (y <= activeTop) return null;

  const leftThreshold = width * leftThresholdRatio;
  const rightThreshold = width * rightThresholdRatio;

  if (x < leftThreshold) return "トイレ";
  if (x > rightThreshold) return "お話";
  return null;
}

/**
 * ターゲット保持ゲージの次の値を計算する。
 * 速すぎる反応を抑えるため、上昇は緩やかにする。
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

export type TargetStabilityState = {
  locked: GazeTarget;
  candidate: GazeTarget;
  candidateFrames: number;
  lostFrames: number;
};

export const INITIAL_TARGET_STABILITY: TargetStabilityState = {
  locked: null,
  candidate: null,
  candidateFrames: 0,
  lostFrames: 0,
};

type StabilityOptions = {
  confirmFrames?: number;
  releaseFrames?: number;
};

/**
 * 生の視線ターゲットを「安定化」して誤反応を減らす。
 * - 切り替え: 連続 confirmFrames 回ヒットしたときだけ確定
 * - 解除: 連続 releaseFrames 回見失ったときだけ解除
 */
export function stepTargetStability(
  prev: TargetStabilityState,
  raw: GazeTarget,
  opts: StabilityOptions = {},
): TargetStabilityState {
  const confirmFrames = opts.confirmFrames ?? 4;
  const releaseFrames = opts.releaseFrames ?? 3;

  // ロック中のターゲットを継続して見ている
  if (raw != null && raw === prev.locked) {
    return { locked: prev.locked, candidate: null, candidateFrames: 0, lostFrames: 0 };
  }

  // 視線を見失った
  if (raw == null) {
    if (prev.locked == null) return INITIAL_TARGET_STABILITY;
    const nextLost = prev.lostFrames + 1;
    if (nextLost >= releaseFrames) return INITIAL_TARGET_STABILITY;
    return {
      locked: prev.locked,
      candidate: null,
      candidateFrames: 0,
      lostFrames: nextLost,
    };
  }

  // ロック中と別ターゲットを見始めた（または未ロック）
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
