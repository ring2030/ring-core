/** 視線エンジン: 虹彩（MediaPipe） / Eyedid（seeso） */

export type StoredGazeEngine = "iris" | "eyedid";

const KEY = "ring_gaze_engine";

export function getStoredGazeEngine(): StoredGazeEngine {
  if (typeof window === "undefined") return "iris";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "iris" || v === "eyedid") return v;
  } catch {
    /* ignore */
  }
  return "iris";
}

export function setStoredGazeEngine(engine: StoredGazeEngine): void {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    /* ignore */
  }
}
