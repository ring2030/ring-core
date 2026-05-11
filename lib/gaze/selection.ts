import { REASON_CHAT, REASON_RESTROOM } from "@/lib/calls/reasons";
import {
  computeNextProgress as coreComputeNextProgress,
  initialStabilityState,
  selectDichotomyTarget,
  stepTargetStability as coreStepTargetStability,
  type TargetStabilityState as CoreTargetStabilityState,
} from "@ring-open/core";

export type GazeTarget = typeof REASON_RESTROOM | typeof REASON_CHAT | null;

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
 * （@ring-open/core の幾何ロジックを ring の理由ラベルに束ねる）
 */
export function selectGazeTarget({
  x,
  y,
  width,
  height,
  leftThresholdRatio = 0.43,
  rightThresholdRatio = 0.57,
}: SelectParams): GazeTarget {
  return selectDichotomyTarget({
    x,
    y,
    width,
    height,
    leftTarget: REASON_RESTROOM,
    rightTarget: REASON_CHAT,
    leftThresholdRatio,
    rightThresholdRatio,
  }) as GazeTarget;
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
  return coreComputeNextProgress(prev, hasTarget, risePerTick, fallPerTick);
}

export type TargetStabilityState = {
  locked: GazeTarget;
  candidate: GazeTarget;
  candidateFrames: number;
  lostFrames: number;
};

export const INITIAL_TARGET_STABILITY: TargetStabilityState =
  initialStabilityState<string>() as TargetStabilityState;

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
  return coreStepTargetStability(
    prev as CoreTargetStabilityState<string>,
    raw as string | null,
    opts,
  ) as TargetStabilityState;
}
