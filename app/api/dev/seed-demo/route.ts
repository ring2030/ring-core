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

// [reason, transcript, note, summary, priority]
const SCENARIOS: Array<[string, string, string, string, number]> = [
  ["トイレ", "", "Call button via gaze. Calm voice.", "Patient requested bathroom assistance. No distress signs detected.", 1],
  ["お話", "足が痛いんだけど", "Reports leg pain while talking slowly.", "Patient reports leg pain. Mild discomfort; monitor and reassess.", 2],
  ["お話", "お腹がすいた", "Meal request around non-meal time.", "Patient is hungry. Routine support and hydration suggested.", 1],
  ["お話", "寒くて眠れない", "Sleep disruption with cold sensation.", "Patient feels cold and cannot sleep. Offer blanket and reassurance.", 2],
  ["トイレ", "", "Second restroom call this shift.", "Bathroom assistance requested.", 1],
  ["お話", "胸が苦しい", "High-risk symptom expression.", "Patient reports chest tightness. Escalate to nurse immediately.", 5],
  ["お話", "娘の写真が見たい", "Emotional support request.", "Patient asked for family photo; companionship need observed.", 1],
  ["お話", "夜中に怖い夢を見た", "Night anxiety / fear after dream.", "Patient had a frightening dream and sought reassurance.", 2],
  ["トイレ", "", "Restroom request repeated within 30 minutes.", "Bathroom request repeated. Check hydration and urgency.", 2],
  ["お話", "頭が割れるように痛い", "Severe pain descriptor used.", "Severe headache reported. Urgent in-person evaluation recommended.", 4],
  ["お話", "テレビをつけてほしい", "Environmental comfort request.", "Patient requested TV to be turned on.", 1],
  ["お話", "息子はいつ来るの", "Frequent family-visit question.", "Patient repeatedly asks when son will visit. Emotional check-in advised.", 1],
  ["お話", "薬を飲み忘れた気がする", "Medication adherence uncertainty.", "Patient unsure about medication intake. Verify chart and schedule.", 3],
  ["トイレ", "", "Routine toileting support requested.", "Bathroom assistance requested.", 1],
  ["お話", "転びそうになった", "Near-fall report while standing.", "Patient reports near-fall. Mobility safety check recommended.", 4],
  ["お話", "何でもないんだけどね", "Called mainly for social presence.", "No specific medical request; likely seeking company.", 1],
  ["お話", "窓を開けたい", "Room comfort / ventilation request.", "Patient wants the window opened.", 1],
  ["トイレ", "", "Toileting support requested before sleep.", "Bathroom assistance requested.", 1],
  ["お話", "咳が止まらない", "Persistent cough complaint.", "Persistent cough reported. Vital signs and respiratory check suggested.", 3],
  ["お話", "お見舞いの花がきれい", "Positive mood statement.", "Patient shared a positive comment about visitor flowers.", 1],
  ["お話", "寝返りがうてない", "Position change assistance needed.", "Patient cannot reposition independently. Pressure-ulcer prevention support needed.", 3],
  ["トイレ", "", "Night restroom call.", "Bathroom assistance requested.", 1],
  ["お話", "看護師さんありがとう", "Expressed gratitude to staff.", "Patient expressed appreciation to nursing staff.", 1],
  ["お話", "点滴の音が気になる", "Sensory irritation from IV pump.", "Patient is bothered by IV pump sound; consider volume/alarm check.", 1],
  ["お話", "吐き気がする", "Nausea complaint with reduced appetite.", "Patient reports nausea. Consider anti-emetic protocol and reassessment.", 3],
];

const DISORIENTED_SUFFIXES = [
  " さっきまで駅にいたのに、ここ病院だった？",
  " 時計が逆に進んでる、朝なのに夜みたい。",
  " ここは学校だったっけ、先生はどこ？",
  " 娘が廊下にいるはず、でも誰もいない。",
  " もう退院したはずなのにベッドが動かない。",
  " 同じ話を何回もしてる気がする、ごめんね。",
  " 今日は月曜日？昨日も月曜日だった気がする。",
  " いま家にいるのかな、窓の外がわからない。",
];

function buildTranscript(base: string, idx: number): string {
  if (!base) return "";
  // Mix in stronger disorganized utterances for dementia-like demo realism.
  // Most chat utterances should include some confusion signal.
  const suffixA = DISORIENTED_SUFFIXES[idx % DISORIENTED_SUFFIXES.length];
  if (idx % 3 === 0) return `${base}${suffixA}`;
  if (idx % 3 === 1) {
    const suffixB = DISORIENTED_SUFFIXES[(idx + 3) % DISORIENTED_SUFFIXES.length];
    return `${base}${suffixA} ${suffixB}`;
  }
  // Keep a minority of lines coherent for contrast.
  return base;
}

const SLOT_HOURS = [9, 14, 20];
const DAY_RANGE = 20;
const FALLBACK_SCENARIO: [string, string, string, string, number] = [
  "お話",
  "調子はどうかな",
  "Fallback seeded note.",
  "Fallback seeded summary.",
  1,
];
const FALLBACK_SENDER = "田中 花子";

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

  const now = new Date();
  const batch = db.batch();
  let seededCount = 0;
  let scenarioIndex = 0;

  for (let dayOffset = -DAY_RANGE; dayOffset <= DAY_RANGE; dayOffset += 1) {
    for (let slot = 0; slot < SLOT_HOURS.length; slot += 1) {
      const scenario = SCENARIOS[scenarioIndex % SCENARIOS.length] ?? FALLBACK_SCENARIO;
      scenarioIndex += 1;
      const [reason, transcriptBase, note, summary, priority] = scenario;
      const sender = SENDERS[scenarioIndex % SENDERS.length] ?? FALLBACK_SENDER;
      const transcript = buildTranscript(transcriptBase, scenarioIndex);
      const reasonCodes = [reason];
      const ts = new Date(now);
      ts.setDate(ts.getDate() + dayOffset);
      const slotHour = SLOT_HOURS[slot] ?? 12;
      ts.setHours(slotHour + (scenarioIndex % 2), (scenarioIndex * 7) % 60, 0, 0);
      const docRef = db.collection(collectionName).doc();

      batch.set(docRef, {
        // Canonical fields (for normalized dashboard/family reads).
        reasonCodes,
        note,
        senderName: sender,
        senderRole: "patient",
        createdAt: Timestamp.fromDate(ts),
        priority,
        aiSummary: summary,
        ...(transcript ? { transcript } : {}),

        // Legacy fields (kept for compatibility).
        理由: reason,
        特記事項: note,
        送信者: sender,
        送信日時: Timestamp.fromDate(ts),
        ステータス: "未対応",
        要約: summary,
        緊急度: priority,
        認識文: transcript,
        seedTag: SEED_TAG,
        hospitalId,
      });
      seededCount += 1;
    }
  }

  await batch.commit();
  return NextResponse.json({
    ok: true,
    seeded: seededCount,
    seedTag: SEED_TAG,
    hospitalId,
    collection: collectionName,
    message: `Seeded ${seededCount} demo calls into ${collectionName} (day range: -${DAY_RANGE} to +${DAY_RANGE}). Open /dashboard/nurse, /dashboard/family, and /dashboard/history to verify.`,
  });
}
