/**
 * Tour chapter schedule.
 *
 * Chapter 0 (intro) is a pre-start gate that waits for user input.
 * The actual 60-second timer covers Chapters 1–4 only.
 *
 * Durations are tuned so that Chapter 1 → Chapter 4 sum to exactly
 * 60 seconds, honoring the "60-second guided tour" promise.
 */
export const CHAPTER_IDS = [0, 1, 2, 3, 4] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface ChapterMeta {
  id: ChapterId;
  /** Seconds. Chapter 0 is wait-only and not counted in the tour timer. */
  durationSec: number;
  label: string;
  /** "hard": cross-fade not allowed. "soft": fade + slide. */
  enterTransition: "hard" | "soft";
}

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 0, durationSec: 0, label: "Intro", enterTransition: "hard" },
  { id: 1, durationSec: 20, label: "Nurse", enterTransition: "hard" },
  { id: 2, durationSec: 17, label: "Family", enterTransition: "soft" },
  { id: 3, durationSec: 13, label: "Team", enterTransition: "soft" },
  { id: 4, durationSec: 10, label: "Outro", enterTransition: "hard" },
] as const;

/** Total runtime that the on-screen progress bar covers. */
export const TOUR_TOTAL_SEC = CHAPTERS.filter((c) => c.id !== 0).reduce(
  (acc, c) => acc + c.durationSec,
  0,
);
