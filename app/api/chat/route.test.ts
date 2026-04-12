import { describe, expect, it } from "vitest";
import { localTriage } from "./route";

describe("localTriage", () => {
  it("returns priority 5 for severe pain wording", () => {
    const r = localTriage("胸が痛いです、助けて");
    expect(r.priority).toBe(5);
  });

  it("returns priority 4 for toilet urgency wording", () => {
    const r = localTriage("トイレ、間に合わない");
    expect(r.priority).toBe(4);
  });

  it("returns priority 2 for anxiety/loneliness wording", () => {
    const r = localTriage("寂しいです");
    expect(r.priority).toBe(2);
  });

  it("returns priority 1 for casual chat", () => {
    const r = localTriage("今日は天気がいいね");
    expect(r.priority).toBe(1);
  });

  it("returns a TriageResponse with all required fields", () => {
    const r = localTriage("テスト");
    expect(r).toHaveProperty("response");
    expect(r).toHaveProperty("summary");
    expect(r).toHaveProperty("priority");
    expect(typeof r.response).toBe("string");
    expect(typeof r.summary).toBe("string");
    expect(typeof r.priority).toBe("number");
  });

  it("returns priority 5 for fall wording (倒れ)", () => {
    expect(localTriage("倒れました").priority).toBe(5);
  });

  it("returns priority 4 for すぐ来て (urgent summon)", () => {
    expect(localTriage("すぐ来てください").priority).toBe(4);
  });

  it("returns priority 3 for お水 (water request)", () => {
    expect(localTriage("お水が欲しいです").priority).toBe(3);
  });

  it("handles empty string without throwing", () => {
    expect(() => localTriage("")).not.toThrow();
  });
});
