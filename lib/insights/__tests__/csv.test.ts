import { describe, expect, it } from "vitest";
import { aggregatesToCsv } from "@/lib/insights/csv";
import type { PhilAggregate } from "@/lib/phil/schema";

function sample(overrides: Partial<PhilAggregate> = {}): PhilAggregate {
  return {
    date: "2026-05-10",
    schema_version: "1.0",
    computed_at: "2026-05-11T00:05:00.000Z",
    sample_size: 100,
    hospitals_count: 4,
    k_anonymity_k: 5,
    insufficient_sample: false,
    emergency_rate: {
      value: 0.018,
      ci_95: [0.014, 0.022],
      numerator: 18,
      denominator: 1000,
    },
    ai_completion_rate: {
      value: 0.738,
      ci_95: [0.71, 0.76],
      numerator: 738,
      denominator: 1000,
    },
    priority_distribution: { "1": 50, "2": 30, "3": 15, "4": 4, "5": 1 },
    reason_distribution: { Restroom: 40, Chat: 35 },
    hourly_pattern: Array.from({ length: 24 }, () => 0),
    staff_time_saved_estimate_min: 320,
    ...overrides,
  };
}

describe("aggregatesToCsv", () => {
  it("includes the header row and one row per aggregate", () => {
    const csv = aggregatesToCsv([sample(), sample({ date: "2026-05-09" })]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("emergency_rate_ci_high");
    expect(lines[1]).toMatch(/^2026-05-10,/);
    expect(lines[2]).toMatch(/^2026-05-09,/);
  });

  it("escapes values that contain commas or quotes", () => {
    const csv = aggregatesToCsv([
      sample({ date: "2026-05-10", schema_version: '1.0,"x"' as never }),
    ]);
    expect(csv).toContain('"1.0,""x"""');
  });

  it("renders 0 / false correctly", () => {
    const csv = aggregatesToCsv([sample({ hospitals_count: 0 })]);
    expect(csv.split("\n")[1]).toContain(",0,");
  });
});
