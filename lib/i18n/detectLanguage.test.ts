import { describe, expect, it } from "vitest";
import { detectLanguage, langLabel, toBCP47 } from "./detectLanguage";

describe("detectLanguage", () => {
  it("returns ja when hiragana appears", () => {
    expect(detectLanguage("こんにちは")).toBe("ja");
  });

  it("returns ja when kanji appears", () => {
    expect(detectLanguage("今日はいい天気")).toBe("ja");
  });

  it("returns en for ASCII-only", () => {
    expect(detectLanguage("Hello, how are you?")).toBe("en");
  });

  it("returns ja when mixing English and Japanese (CJK wins)", () => {
    expect(detectLanguage("please お水")).toBe("ja");
  });
});

describe("toBCP47 / langLabel", () => {
  it("maps ja → ja-JP and JP", () => {
    expect(toBCP47("ja")).toBe("ja-JP");
    expect(langLabel("ja")).toBe("JP");
  });

  it("maps en → en-US and EN", () => {
    expect(toBCP47("en")).toBe("en-US");
    expect(langLabel("en")).toBe("EN");
  });
});
