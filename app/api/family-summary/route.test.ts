import { describe, expect, it } from "vitest";
import { buildPrompt } from "./route";

describe("buildPrompt", () => {
  it("contains warm fallback wording for zero calls", () => {
    const prompt = buildPrompt({ date: "2026/04/10（金）", calls: [] });
    expect(prompt).toContain("呼び出しが0件");
    expect(prompt).toContain("安心できる温かいメッセージ");
  });

  it("includes totals and timeline for non-empty calls", () => {
    const prompt = buildPrompt({
      date: "2026/04/10（金）",
      calls: [
        { reasons: ["トイレ"], notes: "", sender: "きよ子", time: "09:20" },
        { reasons: ["お話"], notes: "AI会話開始", sender: "きよ子", time: "11:10" },
      ],
    });
    expect(prompt).toContain("【呼び出し合計】2回");
    expect(prompt).toContain("09:20 — トイレ");
    expect(prompt).toContain("11:10 — お話（AI会話開始）");
  });
});
