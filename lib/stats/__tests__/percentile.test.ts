import { describe, expect, it } from "vitest";
import { median, percentile, summarize } from "@/lib/stats/percentile";

describe("percentile", () => {
  it("returns NaN for empty input", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });

  it("returns the single value for n=1", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it("matches NumPy default (type 7) on simple inputs", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentile(xs, 50)).toBe(3);
    expect(percentile(xs, 25)).toBe(2);
    expect(percentile(xs, 75)).toBe(4);
    expect(percentile(xs, 90)).toBeCloseTo(4.6, 6);
  });

  it("handles unsorted input", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
  });

  it("ignores non-finite values", () => {
    expect(percentile([1, 2, Number.NaN, 3], 50)).toBe(2);
  });

  it("clamps p to [0,100]", () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
    expect(percentile([1, 2, 3], 200)).toBe(3);
  });
});

describe("median", () => {
  it("matches percentile(50)", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("summarize", () => {
  it("returns NaN-filled summary on empty input", () => {
    const s = summarize([]);
    expect(s.n).toBe(0);
    expect(Number.isNaN(s.p50)).toBe(true);
  });

  it("computes all keys", () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(s.n).toBe(10);
    expect(s.min).toBe(1);
    expect(s.max).toBe(10);
    expect(s.p50).toBe(5.5);
  });
});
