import { describe, expect, it } from "vitest";
import { trackingLabel } from "./trackingLabel";

describe("trackingLabel", () => {
  it("maps 0 to 良好", () => expect(trackingLabel(0)).toBe("良好"));
  it("maps 1 to やや不安定", () => expect(trackingLabel(1)).toBe("やや不安定"));
  it("maps 2 to 未対応", () => expect(trackingLabel(2)).toBe("未対応"));
  it("maps 3 to 顔が見えない", () => expect(trackingLabel(3)).toBe("顔が見えない"));
  it("returns 待機中 for null", () => expect(trackingLabel(null)).toBe("待機中"));
  it("returns 待機中 for unknown codes", () => expect(trackingLabel(99)).toBe("待機中"));
});
