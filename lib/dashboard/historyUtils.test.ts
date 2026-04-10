import { describe, expect, it } from "vitest";
import { buildHighlight, dateLabel } from "./historyUtils";

describe("historyUtils", () => {
  it("formats date label in Japanese style", () => {
    const label = dateLabel(new Date("2026-04-10T00:00:00+09:00"));
    expect(label).toContain("2026年4月10日");
  });

  it("returns calm message when no calls", () => {
    const text = buildHighlight([], "2026年4月10日（金）");
    expect(text).toContain("記録がありません");
  });

  it("mentions urgent handling when priority>=4 exists", () => {
    const text = buildHighlight(
      [
        { reason: "トイレ", priority: 4 },
        { reason: "お話", priority: 1 },
      ],
      "2026年4月10日（金）",
    );
    expect(text).toContain("急ぎの対応");
  });
});
