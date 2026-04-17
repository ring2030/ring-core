import { describe, expect, it } from "vitest";
import { buildHighlight, dateLabel } from "./historyUtils";

describe("historyUtils", () => {
  it("formats date label in English style", () => {
    const label = dateLabel(new Date("2026-04-10T00:00:00+09:00"));
    expect(label).toContain("2026/04/10");
    expect(label).toMatch(/\(Fri\)|\(Thu\)/);
  });

  it("returns calm message when no calls", () => {
    const text = buildHighlight([], "2026/04/10 (Fri)");
    expect(text).toContain("no logged calls");
  });

  it("mentions urgent handling when priority>=4 exists", () => {
    const text = buildHighlight(
      [
        { reason: "Restroom", priority: 4 },
        { reason: "Chat", priority: 1 },
      ],
      "2026/04/10 (Fri)",
    );
    expect(text).toContain("urgent");
  });
});
