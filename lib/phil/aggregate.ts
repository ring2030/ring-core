import { wilson95 } from "@/lib/stats/confidenceInterval";
import { percentile } from "@/lib/stats/percentile";
import { applyKAnonymity, K_ANONYMITY_K, MIN_SAMPLE_SIZE } from "@/lib/stats/quality";
import {
  PHIL_SCHEMA_VERSION,
  type AggregatableCall,
  type PhilAggregate,
  type ProportionPoint,
} from "@/lib/phil/schema";

/**
 * Rough heuristic for the "staff time saved" KPI on the public dashboard.
 * Assumes each call that the AI can resolve at priority ≤ 2 spares a nurse
 * roughly 4 minutes of bedside time. Documented in `methodology` page.
 */
const STAFF_TIME_SAVED_MIN_PER_AI_RESOLVED = 4;

function clampPriority(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n as 1 | 2 | 3 | 4 | 5;
}

function isoDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildProportion(numerator: number, denominator: number): ProportionPoint {
  const value = denominator > 0 ? numerator / denominator : 0;
  const [lo, hi] = wilson95(numerator, denominator);
  return {
    value: Math.round(value * 10_000) / 10_000,
    ci_95: [lo, hi],
    numerator,
    denominator,
  };
}

/**
 * Pure, deterministic aggregation. Takes the raw normalized calls for a UTC
 * day and produces the public document. No PII names, transcripts, or
 * hospital IDs reach the output — only counts and proportions.
 */
export function aggregatePhilForDay(
  date: string,
  calls: readonly AggregatableCall[],
): PhilAggregate {
  const sample = calls.length;

  const priorities: Record<"1" | "2" | "3" | "4" | "5", number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  const hourly: number[] = Array.from({ length: 24 }, () => 0);
  const reasonsRaw: Record<string, number> = {};
  const hospitalsSet = new Set<string>();
  const responseTimes: number[] = [];

  let emergency = 0;
  let aiResolvable = 0;

  for (const call of calls) {
    const p = clampPriority(call.priority);
    priorities[String(p) as "1" | "2" | "3" | "4" | "5"] += 1;
    if (p >= 4) emergency += 1;
    if (p <= 2) aiResolvable += 1;

    const hr = call.createdAt.getUTCHours();
    hourly[hr] = (hourly[hr] ?? 0) + 1;

    for (const r of call.reasons) {
      const key = r.trim();
      if (!key) continue;
      reasonsRaw[key] = (reasonsRaw[key] ?? 0) + 1;
    }

    if (typeof call.hospitalId === "string" && call.hospitalId) {
      hospitalsSet.add(call.hospitalId);
    }

    if (
      typeof call.responseTimeSec === "number" &&
      Number.isFinite(call.responseTimeSec) &&
      call.responseTimeSec >= 0
    ) {
      responseTimes.push(call.responseTimeSec);
    }
  }

  const aggregate: PhilAggregate = {
    date,
    schema_version: PHIL_SCHEMA_VERSION,
    computed_at: new Date().toISOString(),
    sample_size: sample,
    hospitals_count: hospitalsSet.size,
    k_anonymity_k: K_ANONYMITY_K,
    insufficient_sample: sample < MIN_SAMPLE_SIZE,
    emergency_rate: buildProportion(emergency, sample),
    ai_completion_rate: buildProportion(aiResolvable, sample),
    priority_distribution: priorities,
    reason_distribution: applyKAnonymity(reasonsRaw, K_ANONYMITY_K),
    hourly_pattern: hourly,
    staff_time_saved_estimate_min: Math.round(
      aiResolvable * STAFF_TIME_SAVED_MIN_PER_AI_RESOLVED,
    ),
  };

  if (responseTimes.length >= MIN_SAMPLE_SIZE) {
    aggregate.response_time = {
      n: responseTimes.length,
      median_sec: Math.round(percentile(responseTimes, 50)),
      p90_sec: Math.round(percentile(responseTimes, 90)),
      p95_sec: Math.round(percentile(responseTimes, 95)),
    };
  }

  return aggregate;
}

/** Convenience: filter raw calls down to one UTC day, then aggregate. */
export function aggregatePhilForDate(
  utcDay: Date,
  calls: readonly AggregatableCall[],
): PhilAggregate {
  const date = isoDateUtc(utcDay);
  const start = Date.UTC(
    utcDay.getUTCFullYear(),
    utcDay.getUTCMonth(),
    utcDay.getUTCDate(),
  );
  const end = start + 24 * 60 * 60 * 1000;
  const filtered = calls.filter((c) => {
    const t = c.createdAt.getTime();
    return t >= start && t < end;
  });
  return aggregatePhilForDay(date, filtered);
}

export { isoDateUtc };
