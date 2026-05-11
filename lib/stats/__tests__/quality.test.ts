import { describe, expect, it } from "vitest";
import { applyKAnonymity, K_ANONYMITY_K, qualityFor } from "@/lib/stats/quality";

describe("qualityFor", () => {
  it("marks reliable when n >= 30", () => {
    expect(qualityFor(30).reliable).toBe(true);
    expect(qualityFor(29).reliable).toBe(false);
  });
  it("marks suppressed when n < k", () => {
    expect(qualityFor(K_ANONYMITY_K - 1).suppressed).toBe(true);
    expect(qualityFor(K_ANONYMITY_K).suppressed).toBe(false);
  });
});

describe("applyKAnonymity", () => {
  it("drops buckets below k and aggregates the suppressed total", () => {
    const out = applyKAnonymity({ a: 12, b: 4, c: 2, d: 7 });
    expect(out["a"]).toBe(12);
    expect(out["d"]).toBe(7);
    expect(out["b"]).toBeUndefined();
    expect(out["c"]).toBeUndefined();
    expect(out["__suppressed__"]).toBe(6);
  });

  it("does not emit __suppressed__ when nothing is dropped", () => {
    const out = applyKAnonymity({ a: 5, b: 6 });
    expect(out["__suppressed__"]).toBeUndefined();
  });

  it("treats negative / fractional inputs defensively", () => {
    const out = applyKAnonymity({ a: -1, b: 2.7 });
    // a→0 (suppressed but counted 0), b→2 (suppressed: < 5)
    expect(out["__suppressed__"]).toBe(2);
  });
});
