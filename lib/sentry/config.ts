/**
 * Shared helpers for Sentry initialisation across server, edge, and client.
 */

/** Clamp a sampling rate env var to [0, 1]. Returns `fallback` on invalid input. */
export function parseSampleRate(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Resolve the Sentry release string.
 * Priority: explicit SENTRY_RELEASE > VERCEL_GIT_COMMIT_SHA (set by Vercel) > undefined
 */
export function resolveRelease(
  explicitRelease: string | undefined,
  commitSha: string | undefined,
): string | undefined {
  const r = explicitRelease?.trim();
  if (r) return r;
  const sha = commitSha?.trim();
  if (sha) return sha;
  return undefined;
}

/**
 * Returns a `beforeSend` hook that strips known PII fields from events
 * before they are sent to Sentry.
 *
 * Strips:
 *  - `message` field (can contain user speech transcript)
 *  - `body.message` from request data
 *  - form values / query string values that look like freetext
 */
export function makePiiBeforeSend() {
  const SENSITIVE_KEYS = [
    "送信者",
    "sender",
    "patientName",
    "認識文",
    "transcript",
    "要約",
    "summary",
    "videoUrl",
    "video_url",
    "email",
    "token",
    "password",
    "sessionId",
  ];

  const scrub = (value: unknown): unknown => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => scrub(item));

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = SENSITIVE_KEYS.some((s) =>
        k.toLowerCase().includes(s.toLowerCase()),
      );
      out[k] = hit ? "[REDACTED]" : scrub(v);
    }
    return out;
  };

  return function beforeSend(
    event: Parameters<NonNullable<import("@sentry/core").ClientOptions["beforeSend"]>>[0],
  ): typeof event | null {
    // Scrub top-level message if it looks like user speech text
    if (event.message) {
      event.message = "[redacted]";
    }
    // Scrub request body fields that could contain freetext
    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      if ("message" in data) {
        (event.request.data as Record<string, unknown>)["message"] = "[redacted]";
      }
    }

    if (event.contexts) {
      event.contexts = scrub(event.contexts) as typeof event.contexts;
    }
    if (event.extra) {
      event.extra = scrub(event.extra) as typeof event.extra;
    }
    if (event.request?.data) {
      event.request.data = scrub(event.request.data);
    }
    if (event.request?.headers) {
      event.request.headers = scrub(event.request.headers) as typeof event.request.headers;
    }
    if (event.request?.cookies) {
      event.request.cookies = scrub(event.request.cookies) as typeof event.request.cookies;
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => {
        if (b.data === undefined) return b;
        return {
          ...b,
          data: scrub(b.data) as typeof b.data,
        };
      });
    }

    return event;
  };
}
