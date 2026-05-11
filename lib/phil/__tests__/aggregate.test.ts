import { describe, expect, it } from "vitest";
import {
  aggregatePhilForDate,
  aggregatePhilForDay,
} from "@/lib/phil/aggregate";
import type { AggregatableCall } from "@/lib/phil/schema";

function call(
  date: string,
  priority: number,
  reasons: string[],
  hospitalId?: string,
  responseTimeSec?: number,
): AggregatableCall {
  return {
    createdAt: new Date(date),
    priority,
    reasons,
    ...(hospitalId !== undefined ? { hospitalId } : {}),
    ...(responseTimeSec !== undefined ? { responseTimeSec } : {}),
  };
}

describe("aggregatePhilForDay", () => {
  it("returns a zero-filled aggregate for an empty input", () => {
    const out = aggregatePhilForDay("2026-05-10", []);
    expect(out.sample_size).toBe(0);
    expect(out.insufficient_sample).toBe(true);
    expect(out.emergency_rate.numerator).toBe(0);
    expect(out.emergency_rate.value).toBe(0);
    expect(out.hourly_pattern).toHaveLength(24);
    expect(out.hourly_pattern.every((x) => x === 0)).toBe(true);
    expect(out.hospitals_count).toBe(0);
  });

  it("clamps malformed priorities into 1..5", () => {
    const calls: AggregatableCall[] = [
      call("2026-05-10T08:00:00Z", -3, []),
      call("2026-05-10T08:00:00Z", 99, []),
      call("2026-05-10T08:00:00Z", 3.4, []),
    ];
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.priority_distribution).toEqual({ "1": 1, "2": 0, "3": 1, "4": 0, "5": 1 });
  });

  it("computes emergency_rate as priority>=4 / total", () => {
    const calls: AggregatableCall[] = [];
    for (let i = 0; i < 95; i++) calls.push(call("2026-05-10T08:00:00Z", 1, []));
    for (let i = 0; i < 5; i++) calls.push(call("2026-05-10T08:00:00Z", 5, []));
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.emergency_rate.numerator).toBe(5);
    expect(out.emergency_rate.denominator).toBe(100);
    expect(out.emergency_rate.value).toBeCloseTo(0.05, 4);
    expect(out.emergency_rate.ci_95[0]).toBeLessThan(0.05);
    expect(out.emergency_rate.ci_95[1]).toBeGreaterThan(0.05);
  });

  it("computes ai_completion_rate as priority<=2 / total", () => {
    const calls: AggregatableCall[] = [];
    for (let i = 0; i < 30; i++) calls.push(call("2026-05-10T08:00:00Z", 1, []));
    for (let i = 0; i < 10; i++) calls.push(call("2026-05-10T08:00:00Z", 3, []));
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.ai_completion_rate.value).toBeCloseTo(0.75, 4);
  });

  it("counts unique hospitals without revealing IDs", () => {
    const out = aggregatePhilForDay("2026-05-10", [
      call("2026-05-10T08:00:00Z", 1, [], "h-1"),
      call("2026-05-10T09:00:00Z", 1, [], "h-2"),
      call("2026-05-10T10:00:00Z", 1, [], "h-1"),
    ]);
    expect(out.hospitals_count).toBe(2);
    expect(JSON.stringify(out)).not.toContain("h-1");
    expect(JSON.stringify(out)).not.toContain("h-2");
  });

  it("buckets hourly_pattern by UTC hour", () => {
    const calls = [
      call("2026-05-10T03:15:00Z", 1, []),
      call("2026-05-10T03:45:00Z", 1, []),
      call("2026-05-10T17:00:00Z", 1, []),
    ];
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.hourly_pattern[3]).toBe(2);
    expect(out.hourly_pattern[17]).toBe(1);
    expect(out.hourly_pattern.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("applies k-anonymity to the reason_distribution", () => {
    const calls: AggregatableCall[] = [];
    for (let i = 0; i < 10; i++) calls.push(call("2026-05-10T08:00:00Z", 1, ["Restroom"]));
    for (let i = 0; i < 6; i++) calls.push(call("2026-05-10T08:00:00Z", 1, ["Chat"]));
    for (let i = 0; i < 3; i++) calls.push(call("2026-05-10T08:00:00Z", 1, ["Rare reason"]));
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.reason_distribution["Restroom"]).toBe(10);
    expect(out.reason_distribution["Chat"]).toBe(6);
    expect(out.reason_distribution["Rare reason"]).toBeUndefined();
    expect(out.reason_distribution["__suppressed__"]).toBe(3);
  });

  it("only emits response_time when n >= 30", () => {
    const few = aggregatePhilForDay("2026-05-10", [
      call("2026-05-10T08:00:00Z", 1, [], undefined, 12),
    ]);
    expect(few.response_time).toBeUndefined();

    const many: AggregatableCall[] = [];
    for (let i = 0; i < 40; i++) {
      many.push(call("2026-05-10T08:00:00Z", 1, [], undefined, 10 + i));
    }
    const out = aggregatePhilForDay("2026-05-10", many);
    expect(out.response_time?.n).toBe(40);
    expect(out.response_time?.median_sec).toBeGreaterThan(0);
    expect(out.response_time?.p95_sec).toBeGreaterThanOrEqual(
      out.response_time?.median_sec ?? 0,
    );
  });

  it("staff_time_saved_estimate_min ≈ 4 × ai_resolvable", () => {
    const calls: AggregatableCall[] = [];
    for (let i = 0; i < 10; i++) calls.push(call("2026-05-10T08:00:00Z", 1, []));
    for (let i = 0; i < 5; i++) calls.push(call("2026-05-10T08:00:00Z", 5, []));
    const out = aggregatePhilForDay("2026-05-10", calls);
    expect(out.staff_time_saved_estimate_min).toBe(40);
  });
});

describe("aggregatePhilForDate", () => {
  it("only includes calls that fall inside the UTC day", () => {
    const day = new Date("2026-05-10T12:00:00Z");
    const calls = [
      call("2026-05-09T23:59:59Z", 1, []),
      call("2026-05-10T00:00:00Z", 1, []),
      call("2026-05-10T23:59:59Z", 1, []),
      call("2026-05-11T00:00:00Z", 1, []),
    ];
    const out = aggregatePhilForDate(day, calls);
    expect(out.date).toBe("2026-05-10");
    expect(out.sample_size).toBe(2);
  });
});

describe("PII boundary", () => {
  it("never leaks PII fields from raw calls", () => {
    const calls: AggregatableCall[] = [
      call("2026-05-10T08:00:00Z", 1, ["Restroom"], "hospital-secret"),
      call("2026-05-10T09:00:00Z", 2, ["Chat"], "hospital-secret-2"),
    ];
    const out = aggregatePhilForDay("2026-05-10", calls);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("hospital-secret");
    expect(serialized).not.toContain("senderName");
    expect(serialized).not.toContain("transcript");
  });
});
