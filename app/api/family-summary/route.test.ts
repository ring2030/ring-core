import { describe, expect, it } from "vitest";
import { buildPrompt } from "./route";

describe("buildPrompt", () => {
  it("contains warm fallback wording for zero calls", () => {
    const prompt = buildPrompt({ date: "2026/04/10 (Fri)", calls: [] });
    expect(prompt).toContain("0 calls");
    expect(prompt).toContain("reassuring");
  });

  it("includes totals and timeline for non-empty calls", () => {
    const prompt = buildPrompt({
      date: "2026/04/10 (Fri)",
      calls: [
        { reasons: ["Restroom"], notes: "", sender: "Kiyoko", time: "09:20" },
        { reasons: ["Chat"], notes: "AI chat start", sender: "Kiyoko", time: "11:10" },
      ],
    });
    expect(prompt).toContain("Total calls: 2");
    expect(prompt).toContain("09:20 — Restroom");
    expect(prompt).toContain("11:10 — Chat (AI chat start)");
  });
});
