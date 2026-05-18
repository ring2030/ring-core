import { describe, expect, it } from "vitest";
import { clusterCalendarBases, lightDayOffsets } from "@/lib/demo/demoDateDistribution";
import { planDemoEntries } from "@/lib/demo/demoScenarioPlanner";

describe("demo date distribution", () => {
  it("clusters on May 17–18 when those dates are in the past", () => {
    const now = new Date(2026, 4, 18, 16, 0, 0);
    const bases = clusterCalendarBases(now);
    expect(bases).toHaveLength(2);
    expect(bases[0]?.getDate()).toBe(17);
    expect(bases[1]?.getDate()).toBe(18);

    const entries = planDemoEntries(now, 42);
    const byDom = new Map<number, number>();
    for (const e of entries) {
      byDom.set(e.at.getDate(), (byDom.get(e.at.getDate()) ?? 0) + 1);
    }
    expect(byDom.get(17) ?? 0).toBeGreaterThan(byDom.get(10) ?? 0);
    expect(byDom.get(18) ?? 0).toBeGreaterThan(byDom.get(10) ?? 0);
  });

  it("excludes May 17–18 from light tail offsets", () => {
    const now = new Date(2026, 4, 18, 12, 0, 0);
    const offsets = lightDayOffsets(now);
    for (const off of offsets) {
      const d = new Date(now);
      d.setDate(d.getDate() + off);
      expect(d.getDate() === 17 || d.getDate() === 18).toBe(false);
    }
  });
});
