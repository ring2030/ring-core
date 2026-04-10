import { describe, expect, it, vi } from "vitest";
import {
  CAL_TS_KEY,
  EYEDID_CAL_KEY,
  EYEDID_CAL_TTL_MS,
  hasFreshEyedidCalibration,
} from "./eyedidStorage";

describe("hasFreshEyedidCalibration", () => {
  it("returns false when storage is empty", () => {
    localStorage.removeItem(CAL_TS_KEY);
    localStorage.removeItem(EYEDID_CAL_KEY);
    expect(hasFreshEyedidCalibration()).toBe(false);
  });

  it("returns true when timestamp is within ttl", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    localStorage.setItem(CAL_TS_KEY, String(now - EYEDID_CAL_TTL_MS + 1000));
    localStorage.setItem(EYEDID_CAL_KEY, "dummy");
    expect(hasFreshEyedidCalibration()).toBe(true);
    vi.restoreAllMocks();
  });

  it("returns false when calibration is stale", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    localStorage.setItem(CAL_TS_KEY, String(now - EYEDID_CAL_TTL_MS - 1000));
    localStorage.setItem(EYEDID_CAL_KEY, "dummy");
    expect(hasFreshEyedidCalibration()).toBe(false);
    vi.restoreAllMocks();
  });
});
