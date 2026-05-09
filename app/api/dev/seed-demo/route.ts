// app/api/dev/seed-demo/route.ts
//
// Manual demo seeder (browser): ?key=SEED_DEMO_SECRET
// Optional: &rotation=123  (UTC day number) to force a specific RNG day.

import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const expected = process.env["SEED_DEMO_SECRET"];
  const provided = req.nextUrl.searchParams.get("key");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json(
      { error: "forbidden — provide ?key=<SEED_DEMO_SECRET>" },
      { status: 403 },
    );
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
  const action = req.nextUrl.searchParams.get("action") ?? "seed";

  if (action === "clean") {
    const removed = await deleteDemoCallsByTags(db, collectionName, ALL_DEMO_SEED_TAGS);
    return NextResponse.json({ ok: true, removed, seedTags: [...ALL_DEMO_SEED_TAGS] });
  }

  if (action !== "seed") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const rotParam = req.nextUrl.searchParams.get("rotation");
  const rotationDay =
    rotParam !== null && /^\d+$/.test(rotParam) ? Number(rotParam) : utcRotationDay();

  const now = new Date();
  const pending = buildPendingAdminDemoWrites(db, collectionName, now, rotationDay, DEMO_SEED_TAG);
  await commitPendingWrites(db, pending);

  return NextResponse.json({
    ok: true,
    seeded: pending.length,
    perResident: perResidentCounts(pending),
    weekdayBreakdown: summarizeWeekdays(pending),
    rotationDay,
    seedTag: DEMO_SEED_TAG,
    collection: collectionName,
    message: `✅ ${pending.length} 件を書き込みました — ${collectionName}`,
  });
}
