/** Common-sense quality flags used across PHIL aggregates. */

/** Minimum sample size below which we hide point estimates and surface a warning. */
export const MIN_SAMPLE_SIZE = 30;

/** k-anonymity bucket floor — buckets with < k members are suppressed entirely. */
export const K_ANONYMITY_K = 5;

export type QualityFlags = {
  sample_size: number;
  /** True when n ≥ MIN_SAMPLE_SIZE; consumers should hide point estimates otherwise. */
  reliable: boolean;
  /** True when n < K_ANONYMITY_K — the bucket should be suppressed from public views. */
  suppressed: boolean;
};

export function qualityFor(sampleSize: number): QualityFlags {
  const n = Math.max(0, Math.floor(sampleSize));
  return {
    sample_size: n,
    reliable: n >= MIN_SAMPLE_SIZE,
    suppressed: n < K_ANONYMITY_K,
  };
}

/**
 * Suppress entries in a counted-bucket map that fall below the k-anonymity
 * threshold. Returns a *new* object; the suppressed buckets are aggregated
 * under the `__suppressed__` key so the caller can still report the total
 * size of the "too small to publish" set.
 */
export function applyKAnonymity(
  buckets: Readonly<Record<string, number>>,
  k = K_ANONYMITY_K,
): Record<string, number> {
  const out: Record<string, number> = {};
  let suppressed = 0;
  for (const [key, raw] of Object.entries(buckets)) {
    const count = Math.max(0, Math.floor(raw));
    if (count < k) {
      suppressed += count;
      continue;
    }
    out[key] = count;
  }
  if (suppressed > 0) out["__suppressed__"] = suppressed;
  return out;
}
