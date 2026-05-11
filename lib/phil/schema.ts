/**
 * Public Health Insight Layer (PHIL) document schema.
 *
 * Stored under Firestore collection `phil_aggregates`, keyed by ISO-8601
 * UTC date (e.g. "2026-05-10"). These documents are publicly readable —
 * keep PII out, mind k-anonymity (lib/stats/quality.ts).
 */

export const PHIL_SCHEMA_VERSION = "1.0" as const;

export type ProportionPoint = {
  /** Point estimate p̂ ∈ [0, 1]. */
  value: number;
  /** 95% Wilson confidence interval. */
  ci_95: [number, number];
  /** Numerator (count of successes). */
  numerator: number;
  /** Denominator (sample size for this proportion). */
  denominator: number;
};

export type DurationSummary = {
  n: number;
  median_sec: number;
  p90_sec: number;
  p95_sec: number;
};

export type PhilAggregate = {
  /** YYYY-MM-DD, UTC. Also used as Firestore document ID. */
  date: string;
  schema_version: typeof PHIL_SCHEMA_VERSION;
  /** When this aggregate was computed. ISO 8601 string. */
  computed_at: string;
  /** Total calls included for `date`. */
  sample_size: number;
  /** Number of unique hospitals contributing data — count only, never IDs. */
  hospitals_count: number;
  /** k-anonymity threshold under which buckets are suppressed. */
  k_anonymity_k: number;
  /** True when sample_size below the statistical-reliability threshold. */
  insufficient_sample: boolean;
  /** Proportion of priority>=4 calls. */
  emergency_rate: ProportionPoint;
  /** Proportion of calls resolved as priority<=2 (AI conversational tier). */
  ai_completion_rate: ProportionPoint;
  /** Counts per priority 1..5. */
  priority_distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  /** Counts per reason label, with k-anonymity suppression applied. */
  reason_distribution: Record<string, number>;
  /** 24 entries, index = UTC hour 0..23. Each entry is the call count for that hour. */
  hourly_pattern: number[];
  /** Optional: response-time stats (when measured). */
  response_time?: DurationSummary;
  /** Heuristic estimate of nurse-time saved (minutes) given AI completion rate. */
  staff_time_saved_estimate_min: number;
};

/** Minimal call shape consumed by the aggregator. */
export type AggregatableCall = {
  /** Required: server timestamp (UTC). */
  createdAt: Date;
  /** Triage priority 1..5; coerced into that range. */
  priority: number;
  /** Already-normalized English reason labels (lib/calls/reasons.ts). */
  reasons: string[];
  /** Hospital identifier — used only for counting unique hospitals; never published. */
  hospitalId?: string;
  /** Optional response-time in seconds (call → nurse acknowledgement). */
  responseTimeSec?: number;
};
