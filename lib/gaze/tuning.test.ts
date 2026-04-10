import { describe, expect, it } from "vitest";
import { DEFAULT_GAZE_TUNING, normalizeGazeTuning } from "./tuning";

describe("normalizeGazeTuning", () => {
  it("fills defaults", () => {
    expect(normalizeGazeTuning({})).toEqual(DEFAULT_GAZE_TUNING);
  });

  it("clamps out-of-range values", () => {
    const t = normalizeGazeTuning({
      leftThresholdRatio: 0.01,
      rightThresholdRatio: 0.99,
      confirmFrames: 100,
      releaseFrames: 0,
      risePerTick: 99,
      fallPerTick: -1,
    });
    expect(t.leftThresholdRatio).toBe(0.2);
    expect(t.rightThresholdRatio).toBe(0.8);
    expect(t.confirmFrames).toBe(10);
    expect(t.releaseFrames).toBe(1);
    expect(t.risePerTick).toBe(10);
    expect(t.fallPerTick).toBe(1);
  });
});
