import { describe, expect, it } from "vitest";
import { wilsonInterval, wilson95 } from "@/lib/stats/confidenceInterval";

describe("wilsonInterval", () => {
  it("returns [0,0] for zero total", () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 0]);
  });

  it("brackets the observed proportion", () => {
    const [lo, hi] = wilsonInterval(15, 100);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(1);
    expect(lo).toBeLessThan(0.15);
    expect(hi).toBeGreaterThan(0.15);
  });

  it("matches known textbook value within 1e-3 (k=15,n=100,z=1.96)", () => {
    const [lo, hi] = wilsonInterval(15, 100);
    // Newcombe 1998 Table I → ≈[0.0933, 0.2328]
    expect(lo).toBeCloseTo(0.0933, 3);
    expect(hi).toBeCloseTo(0.2328, 3);
  });

  it("narrows toward p as n grows", () => {
    const [, hiSmall] = wilsonInterval(5, 50);
    const [, hiBig] = wilsonInterval(500, 5000);
    expect(hiBig - 0.1).toBeLessThan(hiSmall - 0.1);
  });

  it("clamps to [0,1] for extreme proportions", () => {
    const [lo, hi] = wilsonInterval(0, 100);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);

    const [lo2, hi2] = wilsonInterval(100, 100);
    expect(lo2).toBeGreaterThanOrEqual(0);
    expect(hi2).toBeLessThanOrEqual(1);
  });

  it("wilson95 rounds to requested digits", () => {
    const [lo, hi] = wilson95(15, 100, 3);
    expect(lo).toBeCloseTo(0.093, 3);
    expect(hi).toBeCloseTo(0.233, 3);
  });
});
