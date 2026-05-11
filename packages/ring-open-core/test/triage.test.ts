import { describe, expect, it } from "vitest";
import { matchKeywordPriority } from "../src/triage/priority";

describe("@ring-open/core triage", () => {
  it("matchKeywordPriority", () => {
    const r = matchKeywordPriority("chest pain now", [
      { id: "water", keywords: ["water"], priority: 2 },
      { id: "chest", keywords: ["chest pain"], priority: 5 },
    ]);
    expect(r.priority).toBe(5);
    expect(r.matchedRuleId).toBe("chest");
  });
});
