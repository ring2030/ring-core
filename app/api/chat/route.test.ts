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
});
