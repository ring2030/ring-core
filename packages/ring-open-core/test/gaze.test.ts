import { describe, expect, it } from "vitest";
import {
  computeNextProgress,
  dwellProgress,
  selectDichotomyTarget,
} from "../src/gaze/selection";
import { initialStabilityState, stepTargetStability } from "../src/gaze/stability";

describe("@ring-open/core gaze", () => {
  it("selectDichotomyTarget matches ring geometry", () => {
    expect(
      selectDichotomyTarget({
        x: 120,
        y: 500,
        width: 1200,
        height: 800,
        leftTarget: "L",
        rightTarget: "R",
      }),
    ).toBe("L");
    expect(
      selectDichotomyTarget({
        x: 600,
        y: 500,
        width: 1200,
        height: 800,
        leftTarget: "L",
        rightTarget: "R",
      }),
    ).toBeNull();
  });

  it("dwellProgress", () => {
    expect(dwellProgress(500, 1000)).toBe(50);
  });

  it("computeNextProgress", () => {
    expect(computeNextProgress(0, true)).toBe(3);
  });

  it("stepTargetStability", () => {
    let s = initialStabilityState<string>();
    s = stepTargetStability(s, "A", { confirmFrames: 2 });
    s = stepTargetStability(s, "A", { confirmFrames: 2 });
    expect(s.locked).toBe("A");
  });
});
