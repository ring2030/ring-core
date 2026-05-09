// app/api/dev/seed-demo/route.ts
//
// Demo data seeder for the Nurse Dashboard.
// Hit this URL in your browser to populate the `calls` collection
// with 25 realistic, time-distributed entries.
//
// Usage:
//   1. Add this line to .env.local (any random string is fine):
//        SEED_DEMO_SECRET=ring-magic-2026
//   2. Restart `npm run dev:node`
//   3. Open this URL in your browser:
//        http://localhost:3000/api/dev/seed-demo?key=ring-magic-2026
//   4. Open /dashboard/nurse — you should see 25 entries.
//   5. To remove the seeded data later:
//        http://localhost:3000/api/dev/seed-demo?key=ring-magic-2026&action=clean
//
// Production note:
//   The endpoint is gated by SEED_DEMO_SECRET (returns 403 unless the
//   `?key=...` query string matches the env value). Without the env set,
//   the endpoint always returns 403.

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";
import {
  DEFAULT_HOSPITAL_ID,
  getCallsCollectionNameForHospital,
} from "@/lib/auth/hospitalScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEED_TAG = "demo-seed-2026";

const SENDERS = [
  "田中 花子", "佐藤 きよ", "山本 みつ子",
  "渡辺 たけし", "鈴木 正夫", "高橋 さと",
  "伊藤 ふみ", "中村 はる", "小林 ひさし",
];

// [reason, transcript, summary, priority, hoursAgo]
const SCENARIOS: Array<[string, string, string, number, number]> = [
  ["トイレ", "",                       "Patient requested bathroom assistance. No distress signs detected.",                    1, 0.3],
  ["お話",   "足が痛いんだけど",         "Patient reports leg pain. Mild discomfort — monitoring suggested.",                    2, 0.7],
  ["お話",   "お腹がすいた",             "Patient is hungry. Routine — meal time approaching.",                                  1, 1.4],
  ["お話",   "寒くて眠れない",           "Patient feeling cold, unable to sleep. Suggest extra blanket.",                        2, 2.1],
  ["トイレ", "",                       "Bathroom assistance requested.",                                                       1, 2.9],
  ["お話",   "胸が苦しい",               "Patient reports chest tightness. ESCALATED — staff notified immediately.",             5, 3.4],
  ["お話",   "娘の写真が見たい",         "Patient wants to see family photos. Companionship request.",                           1, 4.2],
  ["お話",   "夜中に怖い夢を見た",       "Patient had a frightening dream, seeking reassurance.",                                2, 5.8],
  ["トイレ", "",                       "Bathroom — second request in 30 minutes. Hydration check suggested.",                  2, 6.5],
  ["お話",   "頭が割れるように痛い",     "Severe headache reported. Urgent evaluation recommended.",                              4, 7.7],
  ["お話",   "テレビをつけてほしい",     "Patient requesting TV to be turned on.",                                                1, 8.6],
  ["お話",   "息子はいつ来るの",         "Patient asking when son will visit. Emotional check-in needed.",                       1, 10.3],
  ["お話",   "薬を飲み忘れた気がする",   "Patient unsure if medication was taken. Verify against chart.",                        3, 12.8],
  ["トイレ", "",                       "Bathroom assistance requested.",                                                       1, 14.5],
  ["お話",   "転びそうになった",         "Patient reports near-fall. Mobility assessment recommended.",                          4, 16.9],
  ["お話",   "何でもないんだけどね",     "Patient called but indicated no specific need. Likely seeking company.",               1, 18.4],
  ["お話",   "窓を開けたい",             "Patient wants window opened.",                                                         1, 20.2],
  ["トイレ", "",                       "Bathroom assistance requested.",                                                       1, 22.8],
  ["お話",   "咳が止まらない",           "Persistent cough reported. Vital signs check recommended.",                            3, 25.1],
  ["お話",   "お見舞いの花がきれい",     "Patient sharing positive observation about visitor flowers.",                          1, 28.3],
  ["お話",   "寝返りがうてない",         "Patient unable to reposition. Repositioning needed (pressure ulcer prevention).",     3, 32.4],
  ["トイレ", "",                       "Bathroom assistance requested.",                                                       1, 36.7],
  ["お話",   "看護師さんありがとう",     "Patient expressing gratitude to staff.",                                               1, 40.1],
  ["お話",   "点滴の音が気になる",       "Patient bothered by IV pump sound. Volume check.",                                     1, 44.2],
  ["お話",   "吐き気がする",             "Patient reports nausea. Anti-emetic protocol may be needed.",                          3, 48.0],
];

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

  const hospitalId =
    process.env["DEMO_HOSPITAL_ID"]?.trim() || DEFAULT_HOSPITAL_ID;
  const collectionName = getCallsCollectionNameForHospital(hospitalId);
  const action = req.nextUrl.searchParams.get("action") ?? "seed";

  if (action === "clean") {
    const snap = await db
      .collection(collectionName)
      .where("seedTag", "==", SEED_TAG)
      .get();
    if (snap.empty) {
      return NextResponse.json({
        ok: true,
        removed: 0,
        message: "no seeded entries found",
      });
    }
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return NextResponse.json({ ok: true, removed: snap.size });
  }

  if (action !== "seed") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const now = Date.now();
  const batch = db.batch();

  SCENARIOS.forEach(([reason, transcript, summary, priority, hoursAgo], i) => {
    const docRef = db.collection(collectionName).doc();
    const ts = new Date(now - hoursAgo * 60 * 60 * 1000);
    const sender = SENDERS[i % SENDERS.length];

    batch.set(docRef, {
      理由: reason,
      特記事項: "",
      送信者: sender,
      送信日時: Timestamp.fromDate(ts),
      ステータス: "未対応",
      要約: summary,
      緊急度: priority,
      認識文: transcript,
      seedTag: SEED_TAG,
      hospitalId,
    });
  });

  await batch.commit();
  return NextResponse.json({
    ok: true,
    seeded: SCENARIOS.length,
    seedTag: SEED_TAG,
    hospitalId,
    collection: collectionName,
    message: `Seeded ${SCENARIOS.length} demo calls into ${collectionName}. Open /dashboard/nurse to see them.`,
  });
}
