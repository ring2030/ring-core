// Daily Public Health Insight Layer aggregation.
//
// Runs once per UTC day (Vercel Cron schedule in vercel.json). Reads
// yesterday's `calls` documents via firebase-admin, runs the pure aggregator,
// and writes a single document to `phil_aggregates/{YYYY-MM-DD}`.
//
// Secured with `Authorization: Bearer ${CRON_SECRET}`. Manual triggering for
// dev/QA is supported via `?date=YYYY-MM-DD&dryRun=1`.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";
import { aggregatePhilForDate, isoDateUtc } from "@/lib/phil/aggregate";
import { readAggregatableCallsForUtcDay } from "@/lib/phil/firestoreReader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function previousUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
    ),
  );
}

function parseRequestedDate(url: URL): { day: Date; iso: string } | { error: string } {
  const param = url.searchParams.get("date");
  if (param) {
    if (!ISO_DATE_RE.test(param)) {
      return { error: "Invalid `date` — expected YYYY-MM-DD (UTC)." };
    }
    const day = new Date(`${param}T00:00:00Z`);
    if (!Number.isFinite(day.getTime())) {
      return { error: "Invalid `date` — could not parse as UTC day." };
    }
    return { day, iso: param };
  }
  const day = previousUtcDay(new Date());
  return { day, iso: isoDateUtc(day) };
}

async function handle(req: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = parseRequestedDate(url);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { day, iso } = parsed;
  const dryRun = url.searchParams.get("dryRun") === "1";

  let db;
  try {
    db = getFirebaseAdminDb();
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron:aggregate-phil" } });
    return NextResponse.json(
      {
        error: "firebase-admin init failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  try {
    const calls = await readAggregatableCallsForUtcDay(db, day);
    const aggregate = aggregatePhilForDate(day, calls);

    if (!dryRun) {
      await db
        .collection("phil_aggregates")
        .doc(iso)
        .set({
          ...aggregate,
          computed_at_ts: Timestamp.now(),
        });
    }

    return NextResponse.json({
      ok: true,
      date: iso,
      sample_size: aggregate.sample_size,
      dryRun,
      schema_version: aggregate.schema_version,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron:aggregate-phil" } });
    return NextResponse.json(
      {
        error: "aggregation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
