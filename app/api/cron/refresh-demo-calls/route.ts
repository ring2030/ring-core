// Daily refresh of *tagged* demo calls only (does not touch real tablet writes).
//
// Vercel Cron: configure in vercel.json. Secured with Authorization: Bearer CRON_SECRET.
// Enable only on demo projects: ENABLE_DEMO_DAILY_REFRESH=1

import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";
import { ALL_DEMO_SEED_TAGS, DEMO_SEED_TAG } from "@/lib/demo/demoSeedTags";
import {
  buildPendingAdminDemoWrites,
  commitPendingWrites,
  deleteDemoCallsByTags,
  getDemoCallsCollectionName,
  perResidentCounts,
  summarizeWeekdays,
  utcRotationDay,
} from "@/lib/demo/demoCallSeeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env["ENABLE_DEMO_DAILY_REFRESH"] !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let db;
  try {
    db = getFirebaseAdminDb();
  } catch (err) {
    return NextResponse.json(
      { error: "firebase-admin init failed", detail: String(err) },
      { status: 500 },
    );
  }

  const collectionName = getDemoCallsCollectionName();
  const removed = await deleteDemoCallsByTags(db, collectionName, ALL_DEMO_SEED_TAGS);

  const now = new Date();
  const rotationDay = utcRotationDay(now.getTime());
  const pending = buildPendingAdminDemoWrites(db, collectionName, now, rotationDay, DEMO_SEED_TAG);
  await commitPendingWrites(db, pending);

  return NextResponse.json({
    ok: true,
    removed,
    seeded: pending.length,
    rotationDay,
    perResident: perResidentCounts(pending),
    weekdayBreakdown: summarizeWeekdays(pending),
    seedTag: DEMO_SEED_TAG,
    collection: collectionName,
  });
}
