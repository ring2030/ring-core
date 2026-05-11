// Public researcher API for the PHIL dataset.
//
// Returns one or more aggregate documents from Firestore as a JSON payload
// suitable for citation and downstream analysis. CORS is enabled (research
// tools commonly run from notebooks / static dashboards) and a gentle rate
// limit is applied per IP.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";
import { fetchAggregateRangeAdmin } from "@/lib/phil/fetchPublicAdmin";
import {
  buildRateLimitHeaders,
  captureLimitUnavailable,
  checkRateLimit,
  isRateLimitUnavailableError,
  readRateLimitPolicy,
} from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_API_LICENSE = "CC-BY-4.0";
const SOURCE_LABEL = "ring (ring-core)";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const publicApiPolicy = readRateLimitPolicy("RATE_LIMIT_PHIL_PUBLIC", {
  maxRequests: 100,
  windowMs: 60 * 60 * 1000,
  quietHoursJstStart: 0,
  quietHoursJstEnd: 0,
  quietHoursMultiplier: 1,
});

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    const rl = await checkRateLimit(req, "api:v1:insights", publicApiPolicy);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "rate limit exceeded" },
        {
          status: 429,
          headers: { ...corsHeaders(), ...buildRateLimitHeaders(rl) },
        },
      );
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const limitParam = url.searchParams.get("limit");

    for (const [key, value] of [
      ["from", from],
      ["to", to],
    ] as const) {
      if (value !== undefined && !ISO_DATE_RE.test(value)) {
        return NextResponse.json(
          { error: `Invalid \`${key}\` — expected YYYY-MM-DD.` },
          { status: 400, headers: corsHeaders() },
        );
      }
    }

    let limitN: number | undefined;
    if (limitParam !== null) {
      const n = Number(limitParam);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json(
          { error: "Invalid `limit` — must be a positive integer." },
          { status: 400, headers: corsHeaders() },
        );
      }
      limitN = Math.floor(n);
    }

    let db;
    try {
      db = getFirebaseAdminDb();
    } catch {
      return NextResponse.json(
        { error: "firebase admin credentials not configured" },
        { status: 503, headers: corsHeaders() },
      );
    }
    const rows = await fetchAggregateRangeAdmin(db, {
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(limitN !== undefined ? { limitN } : {}),
    });

    const today = isoToday();
    return NextResponse.json(
      {
        data: rows,
        metadata: {
          source: SOURCE_LABEL,
          license: PUBLIC_API_LICENSE,
          citation: `ring Public Health Insights, retrieved ${today}`,
          schema_version: "1.0",
          retrieved_at: new Date().toISOString(),
          count: rows.length,
        },
      },
      {
        headers: {
          ...corsHeaders(),
          ...buildRateLimitHeaders(rl),
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (error) {
    if (isRateLimitUnavailableError(error)) {
      captureLimitUnavailable(error, "GET /api/v1/insights/aggregates");
      return NextResponse.json(
        { error: "service temporarily unavailable" },
        { status: 503, headers: corsHeaders() },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    Sentry.captureException(error, {
      tags: { route: "api:v1:insights:aggregates" },
    });
    return NextResponse.json(
      process.env["NODE_ENV"] === "production"
        ? { error: "internal error" }
        : { error: "internal error", detail },
      { status: 500, headers: corsHeaders() },
    );
  }
}
