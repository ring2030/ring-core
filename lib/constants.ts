/**
 * Application-wide timing and threshold constants.
 * Import from here rather than defining inline to keep tunable values visible.
 */

// ── Gaze interface ────────────────────────────────────────────────────────────

/** Idle time before entering power-save sleep mode */
export const SLEEP_TIMEOUT_MS = 10_000;

/** How often gaze position is evaluated against targets (target selection loop) */
export const TARGET_SCAN_MS = 120;

/** How often the dwell-gauge progress is updated */
export const PROGRESS_TICK_MS = 120;

// ── Eyedid SDK ────────────────────────────────────────────────────────────────

/** Minimum interval between gaze callbacks forwarded to the UI (throttle) */
export const GAZE_THROTTLE_MS = 16;
