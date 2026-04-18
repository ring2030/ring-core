import { describe, expect, it } from "vitest";
import { trackingLabel } from "./trackingLabel";

describe("trackingLabel", () => {
  it("maps 0 to Good", () => expect(trackingLabel(0)).toBe("Good"));
  it("maps 1 to Slightly unstable", () => expect(trackingLabel(1)).toBe("Slightly unstable"));
  it("maps 2 to Unsupported", () => expect(trackingLabel(2)).toBe("Unsupported"));
  it("maps 3 to Face not visible", () => expect(trackingLabel(3)).toBe("Face not visible"));
  it("returns Idle for null", () => expect(trackingLabel(null)).toBe("Idle"));
  it("returns Idle for unknown codes", () => expect(trackingLabel(99)).toBe("Idle"));
});
