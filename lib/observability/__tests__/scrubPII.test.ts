import { describe, expect, it } from "vitest";
import { scrubPII } from "@/lib/observability/scrubPII";

describe("scrubPII", () => {
  it("redacts sender/transcript/email on a flat object", () => {
    const input = {
      sender: "Kiyoko",
      transcript: "I need help",
      email: "k@example.com",
      priority: 3,
    };

    const out = scrubPII(input) as Record<string, unknown>;
    expect(out["sender"]).toBe("[REDACTED]");
    expect(out["transcript"]).toBe("[REDACTED]");
    expect(out["email"]).toBe("[REDACTED]");
    expect(out["priority"]).toBe(3);
  });

  it("redacts nested object fields recursively", () => {
    const input = {
      payload: {
        patientName: "Kiyoko Tanaka",
        inner: {
          summary: "private summary",
          status: "ok",
        },
      },
    };

    const out = scrubPII(input) as {
      payload: { patientName: unknown; inner: { summary: unknown; status: unknown } };
    };

    expect(out.payload.patientName).toBe("[REDACTED]");
    expect(out.payload.inner.summary).toBe("[REDACTED]");
    expect(out.payload.inner.status).toBe("ok");
  });

  it("redacts fields recursively inside arrays", () => {
    const input = [
      { sender: "A", status: "safe" },
      { meta: { videoUrl: "https://example.com/video.mp4" } },
    ];

    const out = scrubPII(input) as Array<Record<string, unknown>>;
    expect(out[0]?.["sender"]).toBe("[REDACTED]");
    expect(out[0]?.["status"]).toBe("safe");
    expect((out[1]?.["meta"] as Record<string, unknown>)?.["videoUrl"]).toBe("[REDACTED]");
  });

  it("keeps non-sensitive keys untouched", () => {
    const input = { priority: 4, status: "pending", safe_field: "normal value" };
    const out = scrubPII(input) as Record<string, unknown>;
    expect(out["priority"]).toBe(4);
    expect(out["status"]).toBe("pending");
    expect(out["safe_field"]).toBe("normal value");
  });

  it("redacts Japanese keys", () => {
    const input = { 送信者: "テスト太郎", 認識文: "これはテスト", 要約: "private" };
    const out = scrubPII(input) as Record<string, unknown>;
    expect(out["送信者"]).toBe("[REDACTED]");
    expect(out["認識文"]).toBe("[REDACTED]");
    expect(out["要約"]).toBe("[REDACTED]");
  });

  it("passes through null/undefined/primitive unchanged", () => {
    expect(scrubPII(null)).toBeNull();
    expect(scrubPII(undefined)).toBeUndefined();
    expect(scrubPII("hello")).toBe("hello");
    expect(scrubPII(42)).toBe(42);
    expect(scrubPII(true)).toBe(true);
  });

  it("does not mutate input object", () => {
    const input = {
      sender: "Kiyoko",
      nested: {
        transcript: "private transcript",
        status: "ok",
      },
    };
    const inputSnapshot = JSON.parse(JSON.stringify(input));

    const out = scrubPII(input) as typeof input;

    expect(out).not.toBe(input);
    expect(out.nested).not.toBe(input.nested);
    expect(out.sender).toBe("[REDACTED]");
    expect(out.nested.transcript).toBe("[REDACTED]");
    expect(input).toEqual(inputSnapshot);
  });
});

