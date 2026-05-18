/**
 * Demo call timestamps: cluster on May 17–18 (current year) plus a light tail on other recent days.
 */

/** May = 4 (0-indexed). Cluster calendar days in the seed year. */
export const DEMO_CLUSTER_MONTH = 4;
export const DEMO_CLUSTER_DAYS_OF_MONTH = [17, 18] as const;

const LIGHT_OFFSET_MIN = -21;
const LIGHT_OFFSET_MAX = 0;

/** ~70% of generated calls land on the two cluster calendar days. */
export const DEMO_CLUSTER_SHARE = 0.72;

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function clusterCalendarBases(now: Date): Date[] {
  const y = now.getFullYear();
  const end = startOfLocalDay(now).getTime();
  const out: Date[] = [];
  for (const dom of DEMO_CLUSTER_DAYS_OF_MONTH) {
    const base = startOfLocalDay(new Date(y, DEMO_CLUSTER_MONTH, dom));
    if (base.getTime() <= end) out.push(base);
  }
  return out;
}

/** Day offsets (relative to `now`) that are NOT May 17/18 cluster days. */
export function lightDayOffsets(now: Date): number[] {
  const y = now.getFullYear();
  const skip = new Set(
    DEMO_CLUSTER_DAYS_OF_MONTH.map((dom) => `${y}-${DEMO_CLUSTER_MONTH}-${dom}`),
  );
  const offsets: number[] = [];
  for (let day = LIGHT_OFFSET_MIN; day <= LIGHT_OFFSET_MAX; day++) {
    const probe = new Date(now);
    probe.setDate(probe.getDate() + day);
    const key = `${probe.getFullYear()}-${probe.getMonth()}-${probe.getDate()}`;
    if (skip.has(key)) continue;
    offsets.push(day);
  }
  return offsets;
}

export function applyTimeOnBase(base: Date, hour: number, minute: number, now: Date): Date | null {
  const ts = new Date(base);
  ts.setHours(hour, minute, 0, 0);
  if (ts.getTime() > now.getTime()) return null;
  return ts;
}

export function applyTimeOnOffset(
  now: Date,
  dayOffset: number,
  hour: number,
  minute: number,
): Date | null {
  const ts = new Date(now);
  ts.setDate(ts.getDate() + dayOffset);
  ts.setHours(hour, minute, 0, 0);
  if (ts.getTime() > now.getTime()) return null;
  return ts;
}
