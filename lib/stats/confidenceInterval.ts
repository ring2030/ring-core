/**
 * Wilson score interval for a binomial proportion.
 *
 * More accurate than the normal-approximation interval for small samples
 * and proportions near 0 or 1 — preferred in medical / epidemiological
 * literature. See Wilson 1927; Brown, Cai, DasGupta 2001.
 *
 *   z = 1.96 → ≈95% confidence
 *   z = 2.576 → ≈99% confidence
 */
export function wilsonInterval(
  successes: number,
  total: number,
  z = 1.96,
): [number, number] {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0) {
    return [0, 0];
  }
  const k = Math.max(0, Math.min(successes, total));
  const n = total;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const lo = Math.max(0, center - margin);
  const hi = Math.min(1, center + margin);
  return [lo, hi];
}

/** Convenience wrapper: 95% Wilson interval rounded to `digits` decimals. */
export function wilson95(
  successes: number,
  total: number,
  digits = 4,
): [number, number] {
  const [lo, hi] = wilsonInterval(successes, total, 1.96);
  const f = (x: number) =>
    Math.round(x * 10 ** digits) / 10 ** digits;
  return [f(lo), f(hi)];
}
