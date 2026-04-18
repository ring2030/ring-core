/** Map Eyedid TrackingState codes to short English labels (debug / diagnostics). */
export function trackingLabel(state: number | null): string {
  if (state === 0) return "Good";
  if (state === 1) return "Slightly unstable";
  if (state === 2) return "Unsupported";
  if (state === 3) return "Face not visible";
  return "Idle";
}
