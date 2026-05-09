import { Redis } from "@upstash/redis";

type RateLimitPolicy = {
  windowMs: number;
  maxRequests: number;
  quietHoursJstStart: number;
  quietHoursJstEnd: number;
  quietHoursMultiplier: number;
};

type RateLimitResult = {
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
const memoryState: CounterStoreWithMeta = g.__ringRateLimitStore ?? { store: new Map<string, CounterEntry>() };
g.__ringRateLimitStore = memoryState;
let redisClient: Redis | null | undefined;
const RATE_LIMIT_UNAVAILABLE_CODE = "RATE_LIMIT_UNAVAILABLE";

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

export function readRateLimitPolicy(envPrefix: string, defaults: RateLimitPolicy): RateLimitPolicy {
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

function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function checkRateLimit(
  request: Request,
  scope: string,
  policy: RateLimitPolicy,
  actorSegment = "default",
): Promise<RateLimitResult> {
  const now = Date.now();
  const clientKey = clientKeyFromRequest(request);
  const effectiveLimit = effectiveMaxRequests(policy, now);
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

type IncrementParams = {
  key: string;
  windowMs: number;
  windowStartMs: number;
  windowEndMs: number;
  limit: number;
  resetSec: number;
};

async function incrementFromBestEffortStore(params: IncrementParams): Promise<RateLimitResult> {
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

async function incrementFromRedis(key: string, windowMs: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("Redis REST credentials are not configured.");
  }
  const nextCount = await redis.incr(key);
  if (nextCount === 1) {
    // Keep for one full window plus tiny safety buffer.
    const ttlSec = Math.max(Math.ceil(windowMs / 1000) + 2, 2);
    await redis.expire(key, ttlSec);
  }
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

function effectiveMaxRequests(policy: RateLimitPolicy, nowMs: number): number {
  const jstHour = new Date(nowMs + 9 * 60 * 60 * 1000).getUTCHours();
  const inQuietHours = isInQuietHours(jstHour, policy.quietHoursJstStart, policy.quietHoursJstEnd);
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
      ? {
          "Retry-After": String(result.retryAfterSec),
        }
      : {}),
  };
}
