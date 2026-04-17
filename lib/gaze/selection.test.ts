import { describe, expect, it } from "vitest";
import { REASON_CHAT, REASON_RESTROOM } from "@/lib/calls/reasons";
import {
  computeNextProgress,
  INITIAL_TARGET_STABILITY,
  selectGazeTarget,
  stepTargetStability,
  type TargetStabilityState,
} from "./selection";

describe("selectGazeTarget", () => {
  it("returns left target when gaze is in left active area", () => {
    const target = selectGazeTarget({ x: 120, y: 500, width: 1200, height: 800 });
    expect(target).toBe(REASON_RESTROOM);
  });

  it("returns right target when gaze is in right active area", () => {
    const target = selectGazeTarget({ x: 1100, y: 500, width: 1200, height: 800 });
    expect(target).toBe(REASON_CHAT);
  });

  it("returns null in center dead zone", () => {
    const target = selectGazeTarget({ x: 600, y: 500, width: 1200, height: 800 });
    expect(target).toBeNull();
  });

  it("respects custom thresholds", () => {
    const target = selectGazeTarget({
      x: 500,
      y: 500,
      width: 1000,
      height: 800,
      leftThresholdRatio: 0.55,
      rightThresholdRatio: 0.75,
    });
    expect(target).toBe(REASON_RESTROOM);
  });

  it("returns null in the top inactive strip (y <= 10% height)", () => {
    // y=79 is exactly at the boundary for height=800 (10% = 80)
    expect(selectGazeTarget({ x: 100, y: 79, width: 1200, height: 800 })).toBeNull();
  });

  it("returns null for non-finite coordinates", () => {
    expect(selectGazeTarget({ x: NaN, y: 500, width: 1200, height: 800 })).toBeNull();
    expect(selectGazeTarget({ x: Infinity, y: 500, width: 1200, height: 800 })).toBeNull();
  });

  it("returns null for negative coordinates (off-screen / not yet acquired)", () => {
    expect(selectGazeTarget({ x: -100, y: -100, width: 1200, height: 800 })).toBeNull();
  });
});

describe("computeNextProgress", () => {
  it("rises slowly when target is focused", () => {
    expect(computeNextProgress(0, true)).toBe(3);
    expect(computeNextProgress(98, true)).toBe(100);
  });

  it("falls when focus is lost", () => {
    expect(computeNextProgress(20, false)).toBe(19);
    expect(computeNextProgress(0, false)).toBe(0);
  });

  it("uses custom rise/fall speed", () => {
    expect(computeNextProgress(10, true, 5, 2)).toBe(15);
    expect(computeNextProgress(10, false, 5, 2)).toBe(8);
  });
});

describe("stepTargetStability", () => {
  it("locks target only after consecutive hits", () => {
    let s = INITIAL_TARGET_STABILITY;
    s = stepTargetStability(s, REASON_RESTROOM, { confirmFrames: 3 });
    expect(s.locked).toBeNull();
    s = stepTargetStability(s, REASON_RESTROOM, { confirmFrames: 3 });
    expect(s.locked).toBeNull();
    s = stepTargetStability(s, REASON_RESTROOM, { confirmFrames: 3 });
    expect(s.locked).toBe(REASON_RESTROOM);
  });

  it("does not unlock immediately when one frame is lost", () => {
    let s: TargetStabilityState = {
      ...INITIAL_TARGET_STABILITY,
      locked: REASON_CHAT,
    };
    s = stepTargetStability(s, null, { releaseFrames: 2 });
    expect(s.locked).toBe(REASON_CHAT);
    s = stepTargetStability(s, null, { releaseFrames: 2 });
    expect(s.locked).toBeNull();
  });
});
