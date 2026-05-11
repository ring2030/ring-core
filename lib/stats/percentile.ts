/**
 * Linear-interpolated percentile (NIST C=1 / Hyndman-Fan type 7), the same
 * default used by NumPy, R, and Excel's PERCENTILE.INC.
 *
 *   percentile(xs, 50)  → median
 *   percentile(xs, 90)  → p90
 *
 * Returns NaN if the input has no finite values.
 */
export function percentile(values: readonly number[], p: number): number {
  const xs = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return Number.NaN;
  if (xs.length === 1) return xs[0]!;
  const pct = Math.max(0, Math.min(100, p)) / 100;
  const idx = pct * (xs.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const loVal = xs[lo]!;
  const hiVal = xs[hi]!;
  if (lo === hi) return loVal;
  const frac = idx - lo;
  return loVal + (hiVal - loVal) * frac;
}

export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

export type FivePointSummary = {
  n: number;
  min: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  max: number;
};

export function summarize(values: readonly number[]): FivePointSummary {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) {
    return {
      n: 0,
      min: Number.NaN,
      p25: Number.NaN,
      p50: Number.NaN,
      p75: Number.NaN,
      p90: Number.NaN,
      p95: Number.NaN,
      max: Number.NaN,
    };
  }
  return {
    n: xs.length,
    min: Math.min(...xs),
    p25: percentile(xs, 25),
    p50: percentile(xs, 50),
    p75: percentile(xs, 75),
    p90: percentile(xs, 90),
    p95: percentile(xs, 95),
    max: Math.max(...xs),
  };
}
