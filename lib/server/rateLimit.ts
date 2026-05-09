import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";

type RateLimitPolicy = {
  windowMs: number;
  maxRequests: number;
  quietHoursJstStart: number;
  quietHoursJstEnd: number;
  quietHoursMultiplier: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSec: number;
  retryAfterSec: number;
};

type CounterEntry = {
  windowStartMs: number;
  count: number;
};

type CounterStore = Map<string, CounterEntry>;
type CounterStoreWithMeta = {
  store: CounterStore;
  lastWarnedAtMs?: number;
};

type GlobalWithRateLimit = typeof globalThis & {
  __ringRateLimitStore?: CounterStoreWithMeta;
};

const g = globalThis as GlobalWithRateLimit;
const memoryState: CounterStoreWithMeta =
  g.__ringRateLimitStore ?? { store: new Map<string, CounterEntry>() };
g.__ringRateLimitStore = memoryState;

let redisClient: Redis | null | undefined;
const RATE_LIMIT_UNAVAILABLE_CODE = "RATE_LIMIT_UNAVAILABLE";

// How many requests per window to allow for requests whose IP cannot be determined.
// Deliberately tight — if you can't identify the caller, be conservative.
const UNKNOWN_IP_MAX_REQUESTS_PER_WINDOW = 5;

function clampPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function clampHour(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const normalized = Math.floor(n);
  if (normalized < 0 || normalized > 23) return fallback;
  return normalized;
}

function clampMultiplier(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export function readRateLimitPolicy(
  envPrefix: string,
  defaults: RateLimitPolicy,
): RateLimitPolicy {
  const maxRequests = clampPositiveInt(
    process.env[`${envPrefix}_MAX_REQUESTS`],
    defaults.maxRequests,
  );
  const windowMs = clampPositiveInt(
    process.env[`${envPrefix}_WINDOW_MS`],
    defaults.windowMs,
  );
  const quietHoursJstStart = clampHour(
    process.env[`${envPrefix}_QUIET_HOURS_JST_START`],
    defaults.quietHoursJstStart,
  );
  const quietHoursJstEnd = clampHour(
    process.env[`${envPrefix}_QUIET_HOURS_JST_END`],
    defaults.quietHoursJstEnd,
  );
  const quietHoursMultiplier = clampMultiplier(
    process.env[`${envPrefix}_QUIET_HOURS_MULTIPLIER`],
    defaults.quietHoursMultiplier,
  );
  return {
    maxRequests,
    windowMs,
    quietHoursJstStart,
    quietHoursJstEnd,
    quietHoursMultiplier,
  };
}

/**
 * Resolve the client key from the request.
 *
 * Trust order (most → least reliable):
 *  1. `x-vercel-proxied-for` — set by Vercel's edge network, not forgeable by clients
 *  2. `x-real-ip`            — set by Vercel / reverse proxies
 *  3. `x-forwarded-for` first hop — can be spoofed; used only as last resort
 *
 * Returns `null` when no IP can be determined. Callers apply a tighter budget
 * to null/unknown callers rather than collapsing them into one shared bucket.
 */
function clientKeyFromRequest(request: Request): string | null {
  // Most trustworthy on Vercel — not spoofable by clients
  const vercelProxied = request.headers.get("x-vercel-proxied-for");
  if (vercelProxied) {
    const ip = vercelProxied.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // x-forwarded-for can be injected by clients; use as last resort only
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return null;
}

export function checkRateLimit(
  request: Request,
  scope: string,
  policy: RateLimitPolicy,
  actorSegment = "default",
): Promise<RateLimitResult> {
  const now = Date.now();
  const rawClientKey = clientKeyFromRequest(request);
  const effectiveLimit = rawClientKey !== null
    ? effectiveMaxRequests(policy, now)
    : Math.min(UNKNOWN_IP_MAX_REQUESTS_PER_WINDOW, effectiveMaxRequests(policy, now));

  // Unknown IPs each get an independent bucket keyed to their request timestamp
  // to the window boundary (so they can't all pile into "unknown" and either
  // collectively exhaust the shared limit or collectively avoid it).
  // Instead we hash a portion of the User-Agent to give some per-client bucket,
  // which is better than a single global "unknown" bucket.
  const clientKey = rawClientKey ?? buildUnknownKey(request);

  const windowStartMs = Math.floor(now / policy.windowMs) * policy.windowMs;
  const windowEndMs = windowStartMs + policy.windowMs;
  const resetSec = Math.max(Math.ceil((windowEndMs - now) / 1000), 1);
  const key = `rl:${scope}:${actorSegment}:${clientKey}:${windowStartMs}`;

  return incrementFromBestEffortStore({
    key,
    windowMs: policy.windowMs,
    windowStartMs,
    windowEndMs,
    limit: effectiveLimit,
    resetSec,
  });
}

/**
 * For requests where IP is unavailable, derive a semi-stable key from
 * User-Agent + Accept-Language so callers are not all lumped into one bucket.
 * This is a best-effort heuristic only — use Redis for production accuracy.
 */
function buildUnknownKey(request: Request): string {
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const raw = `${ua}||${lang}`.slice(0, 200);
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ (raw.charCodeAt(i) & 0xff);
    h = h >>> 0;
  }
  return `unknown-${h.toString(16)}`;
}

type IncrementParams = {
  key: string;
  windowMs: number;
  windowStartMs: number;
  windowEndMs: number;
  limit: number;
  resetSec: number;
};

async function incrementFromBestEffortStore(
  params: IncrementParams,
): Promise<RateLimitResult> {
  if (isProduction() && !isKvConfigured()) {
    throw new Error(
      `${RATE_LIMIT_UNAVAILABLE_CODE}: Redis REST credentials are required in production.`,
    );
  }
  try {
    if (isKvConfigured()) {
      const count = await incrementFromRedis(params.key, params.windowMs);
      return toRateLimitResult({
        count,
        limit: params.limit,
        resetSec: params.resetSec,
      });
    }
  } catch (error) {
    if (isProduction()) {
      throw new Error(
        `${RATE_LIMIT_UNAVAILABLE_CODE}: Redis-backed rate limiter is unavailable in production.`,
      );
    }
    maybeWarnKvFallback(error);
  }

  const count = incrementFromMemory(
    params.key,
    params.windowStartMs,
    params.windowEndMs,
  );
  return toRateLimitResult({
    count,
    limit: params.limit,
    resetSec: params.resetSec,
  });
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function isKvConfigured(): boolean {
  const hasVercelKv = Boolean(
    process.env["KV_REST_API_URL"]?.trim() &&
      process.env["KV_REST_API_TOKEN"]?.trim(),
  );
  const hasUpstashRedis = Boolean(
    process.env["UPSTASH_REDIS_REST_URL"]?.trim() &&
      process.env["UPSTASH_REDIS_REST_TOKEN"]?.trim(),
  );
  return hasVercelKv || hasUpstashRedis;
}

/**
 * Atomic INCR + EXPIRE via Upstash Redis pipeline.
 * Both commands are sent in a single HTTP request, so a network failure
 * cannot leave a key without a TTL (unlike two separate calls).
 */
async function incrementFromRedis(
  key: string,
  windowMs: number,
): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("Redis REST credentials are not configured.");
  }
  const ttlSec = Math.max(Math.ceil(windowMs / 1000) + 2, 2);
  // Pipeline: both commands sent atomically in one HTTP round-trip.
  const results = await redis
    .pipeline()
    .incr(key)
    .expire(key, ttlSec)
    .exec();
  const nextCount = results[0] as number;
  return nextCount;
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const hasVercelKvEnv = Boolean(
    process.env["KV_REST_API_URL"]?.trim() &&
      process.env["KV_REST_API_TOKEN"]?.trim(),
  );
  const hasUpstashEnv = Boolean(
    process.env["UPSTASH_REDIS_REST_URL"]?.trim() &&
      process.env["UPSTASH_REDIS_REST_TOKEN"]?.trim(),
  );
  if (!hasVercelKvEnv && !hasUpstashEnv) {
    redisClient = null;
    return redisClient;
  }
  redisClient = Redis.fromEnv();
  return redisClient;
}

function incrementFromMemory(
  key: string,
  windowStartMs: number,
  windowEndMs: number,
): number {
  const prev = memoryState.store.get(key);
  if (!prev || prev.windowStartMs !== windowStartMs) {
    const fresh: CounterEntry = { windowStartMs, count: 1 };
    memoryState.store.set(key, fresh);
    return 1;
  }
  if (Date.now() > windowEndMs) {
    const fresh: CounterEntry = { windowStartMs, count: 1 };
    memoryState.store.set(key, fresh);
    return 1;
  }
  prev.count += 1;
  memoryState.store.set(key, prev);
  return prev.count;
}

function toRateLimitResult(input: {
  count: number;
  limit: number;
  resetSec: number;
}): RateLimitResult {
  if (input.count > input.limit) {
    return {
      allowed: false,
      limit: input.limit,
      remaining: 0,
      resetSec: input.resetSec,
      retryAfterSec: Math.max(input.resetSec, 1),
    };
  }
  return {
    allowed: true,
    limit: input.limit,
    remaining: Math.max(input.limit - input.count, 0),
    resetSec: input.resetSec,
    retryAfterSec: 0,
  };
}

function maybeWarnKvFallback(error: unknown): void {
  const now = Date.now();
  const lastWarn = memoryState.lastWarnedAtMs ?? 0;
  if (now - lastWarn < 60_000) return;
  memoryState.lastWarnedAtMs = now;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[rateLimit] KV unavailable, using in-memory fallback: ${message}`);
}

export function isRateLimitUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(RATE_LIMIT_UNAVAILABLE_CODE);
}

/**
 * Call this from API routes when `isRateLimitUnavailableError` returns true.
 * Sends to Sentry (throttled to 1 per minute to avoid event flooding).
 */
export function captureLimitUnavailable(error: unknown, route: string): void {
  Sentry.captureException(error, {
    tags: { scope: "rateLimit", route },
    level: "error",
  });
}

function effectiveMaxRequests(policy: RateLimitPolicy, nowMs: number): number {
  const jstHour = new Date(nowMs + 9 * 60 * 60 * 1000).getUTCHours();
  const inQuietHours = isInQuietHours(
    jstHour,
    policy.quietHoursJstStart,
    policy.quietHoursJstEnd,
  );
  if (!inQuietHours) return policy.maxRequests;
  const boosted = Math.floor(policy.maxRequests * policy.quietHoursMultiplier);
  return Math.max(boosted, policy.maxRequests);
}

function isInQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetSec),
    ...(result.retryAfterSec > 0
      ? { "Retry-After": String(result.retryAfterSec) }
      : {}),
  };
}
