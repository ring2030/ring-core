import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireServerEnv, validateEnv } from "./validateEnv";

describe("requireServerEnv", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns value when set", () => {
    process.env["TEST_KEY"] = "hello";
    expect(requireServerEnv("TEST_KEY")).toBe("hello");
  });

  it("throws with a clear message when missing", () => {
    delete process.env["TEST_KEY"];
    expect(() => requireServerEnv("TEST_KEY")).toThrowError(/TEST_KEY/);
    expect(() => requireServerEnv("TEST_KEY")).toThrowError(/\.env\.local/);
  });
});

describe("validateEnv", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = origEnv;
    vi.restoreAllMocks();
  });

  it("returns empty array when all required vars are set", () => {
    process.env["GEMINI_API_KEY"] = "key";
    process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] = "k";
    process.env["NEXT_PUBLIC_EYEDID_LICENSE_KEY"] = "k";
    expect(validateEnv()).toEqual([]);
  });

  it("returns list of missing var names", () => {
    delete process.env["GEMINI_API_KEY"];
    delete process.env["NEXT_PUBLIC_EYEDID_LICENSE_KEY"];
    const missing = validateEnv();
    expect(missing).toContain("GEMINI_API_KEY");
    expect(missing).toContain("NEXT_PUBLIC_EYEDID_LICENSE_KEY");
  });

  it("logs a warning when vars are missing", () => {
    delete process.env["GEMINI_API_KEY"];
    validateEnv();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("GEMINI_API_KEY"));
  });

  it("does not log when all vars present", () => {
    process.env["GEMINI_API_KEY"] = "key";
    process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] = "k";
    process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] = "k";
    process.env["NEXT_PUBLIC_EYEDID_LICENSE_KEY"] = "k";
    validateEnv();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
