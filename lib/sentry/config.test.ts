import { describe, expect, it } from "vitest";
import { makePiiBeforeSend, makePiiBeforeSendTransaction } from "@/lib/sentry/config";

describe("makePiiBeforeSend", () => {
  it("scrubs sensitive fields while preserving safe values", () => {
    const beforeSend = makePiiBeforeSend();
    const input = {
      message: "raw user transcript text",
      extra: {
        送信者: "テスト太郎",
        認識文: "これは音声書き起こしのテストです",
        要約: "AI summary contains private context",
        videoUrl: "https://example.com/family-video.mp4",
        email: "test@example.com",
        priority: 3,
        safe_field: "normal value",
      },
      user: {
        id: "u_1",
        email: "user@example.com",
        username: "private",
      },
      request: {
        data: { message: "secret", transcript: "hidden" },
        headers: { authorization: "Bearer abc.def.ghi" },
      },
      breadcrumbs: [
        {
          message: "POST /api token=abc test@example.com",
          data: {
            sessionId: "secret-id",
            status: "ok",
          },
        },
      ],
    };

    const out = beforeSend(input as never) as unknown as typeof input;
    expect(out.message).toBe("[redacted]");
    expect(out.extra?.["送信者"]).toBe("[REDACTED]");
    expect(out.extra?.["認識文"]).toBe("[REDACTED]");
    expect(out.extra?.["要約"]).toBe("[REDACTED]");
    expect(out.extra?.videoUrl).toBe("[REDACTED]");
    expect(out.extra?.email).toBe("[REDACTED]");
    expect(out.extra?.priority).toBe(3);
    expect(out.extra?.safe_field).toBe("normal value");
    expect(out.user).toEqual({ id: "u_1" });
    expect(out.request?.data).toEqual({
      message: "[redacted]",
      transcript: "[REDACTED]",
    });
    expect(out.request?.headers).toEqual({ authorization: "[REDACTED]" });
    expect(out.breadcrumbs?.[0]?.data).toEqual({
      sessionId: "[REDACTED]",
      status: "ok",
    });
    expect(out.breadcrumbs?.[0]?.message).toContain("[email]");
  });
});

describe("makePiiBeforeSendTransaction", () => {
  it("scrubs contexts and extra on transaction events", () => {
    const beforeSendTransaction = makePiiBeforeSendTransaction();
    const out = beforeSendTransaction(
      {
        contexts: {
          call: {
            sender: "Kiyoko",
            transcript: "private text",
            status: "ok",
          },
        },
        extra: {
          token: "abc",
          priority: 2,
        },
      } as never,
    ) as unknown as {
      contexts: { call: { sender: unknown; transcript: unknown; status: unknown } };
      extra: { token: unknown; priority: unknown };
    };

    expect(out.contexts.call.sender).toBe("[REDACTED]");
    expect(out.contexts.call.transcript).toBe("[REDACTED]");
    expect(out.contexts.call.status).toBe("ok");
    expect(out.extra.token).toBe("[REDACTED]");
    expect(out.extra.priority).toBe(2);
  });
});

