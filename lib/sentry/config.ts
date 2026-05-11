/**
 * Shared helpers for Sentry initialisation across server, edge, and client.
 */
import { scrubBreadcrumbMessage, scrubPII } from "@/lib/observability/scrubPII";

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
      event.contexts = scrubPII(event.contexts) as typeof event.contexts;
    }
    if (event.extra) {
      event.extra = scrubPII(event.extra) as typeof event.extra;
    }
    if (event.request?.data) {
      event.request.data = scrubPII(event.request.data);
    }
    if (event.request?.headers) {
      event.request.headers = scrubPII(event.request.headers) as typeof event.request.headers;
    }
    if (event.request?.cookies) {
      event.request.cookies = scrubPII(event.request.cookies) as typeof event.request.cookies;
    }
    if (event.user) {
      if (event.user.id) {
        event.user = { id: event.user.id };
      } else {
        delete event.user;
      }
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => {
        const next = {
          ...b,
        };
        if (b.data) {
          next.data = scrubPII(b.data) as typeof b.data;
        }
        if (typeof b.message === "string") {
          next.message = scrubBreadcrumbMessage(b.message);
        }
        return next;
      });
    }

    return event;
  };
}

export function makePiiBeforeSendTransaction() {
  return function beforeSendTransaction(
    event: Parameters<
      NonNullable<import("@sentry/core").ClientOptions["beforeSendTransaction"]>
    >[0],
  ): typeof event | null {
    if (event.contexts) {
      event.contexts = scrubPII(event.contexts) as typeof event.contexts;
    }
    if (event.extra) {
      event.extra = scrubPII(event.extra) as typeof event.extra;
    }
    return event;
  };
}
