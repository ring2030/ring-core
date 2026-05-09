// app/api/dev/seed-demo/route.ts
//
// Demo data seeder for the Nurse Dashboard.
// Hit this URL in your browser to populate the `calls` collection
// with realistic, multi-day, per-resident entries.
//
// Usage:
//   1. Add this line to .env.local (any random string is fine):
//        SEED_DEMO_SECRET=ring-magic-2026
//   2. Restart `npm run dev:node`
//   3. Open this URL in your browser:
//        http://localhost:3000/api/dev/seed-demo?key=ring-magic-2026
//   4. Open /dashboard/nurse — every resident should now have entries.
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

// Each scenario: [reason, transcript, staffNote, aiSummary, priority]
type Scenario = [string, string, string, string, number];

/** Per-resident persona. The dashboard expects these `senderName`s. */
interface Persona {
  /** Sender name written into Firestore (must match nurse-dashboard PATIENTS.senderNames). */
  senderName: string;
  /** Display name in the AI summary. */
  display: string;
  /** Average calls per day (mean). Day-to-day variance is added. */
  callsPerDay: number;
  /** Pool of scenarios for this resident. */
  scenarios: Scenario[];
}

const KIYOKO: Persona = {
  senderName: "Kiyoko",
  display: "Kiyoko",
  callsPerDay: 6,
  scenarios: [
    ["トイレ", "", "Gaze-call. Calm voice.", "Bathroom assistance requested.", 1],
    ["お話", "娘の写真が見たい", "Asks for daughter photo (3rd time today).", "Wanted to see her daughter's photo. AI showed it and reminisced.", 1],
    ["お話", "夜中に怖い夢を見た 同じ話を何回もしてる気がする", "Night anxiety after dream.", "Frightening dream at night; AI listened and reassured her.", 2],
    ["お話", "ここは病院だっけ さっきまで駅にいたのに", "Disorientation episode (mild).", "Brief disorientation; AI gently reoriented her without distress.", 2],
    ["お話", "息子はいつ来るの", "Repeats this question several times/day.", "Repeated question about son's visit; emotional check-in.", 1],
    ["トイレ", "", "Routine restroom support.", "Bathroom assistance requested.", 1],
    ["お話", "胸が苦しい", "High-risk symptom expression.", "Reported chest tightness. Escalated to nurse immediately.", 5],
    ["お話", "看護師さんありがとう", "Expressed gratitude.", "Expressed appreciation to nursing staff.", 1],
  ],
};

const TARO: Persona = {
  senderName: "Taro",
  display: "Taro",
  callsPerDay: 5,
  scenarios: [
    ["お話", "足が痛いんだけど", "Reports leg pain while talking slowly.", "Reported leg pain. AI offered comfort and flagged for nurse.", 3],
    ["お話", "頭が割れるように痛い", "Severe pain descriptor used.", "Severe headache reported. Urgent in-person evaluation recommended.", 4],
    ["トイレ", "", "Urgent restroom call (Lewy related rigidity).", "Urgent bathroom assistance requested.", 2],
    ["お話", "夜中にまた幻覚が見える", "Lewy-typical visual hallucination.", "Visual hallucination at night; AI grounded him calmly.", 3],
    ["お話", "薬を飲み忘れた気がする", "Medication adherence uncertainty.", "Unsure about medication intake. Verify chart and schedule.", 3],
    ["お話", "寒くて眠れない", "Sleep disruption with cold sensation.", "Feels cold and cannot sleep. Offered blanket and reassurance.", 2],
    ["お話", "転びそうになった", "Near-fall report while standing.", "Near-fall. Mobility safety check recommended.", 4],
    ["お話", "テレビをつけてほしい", "Environmental comfort request.", "Wanted the TV turned on; AI handled.", 1],
  ],
};

const HANAKO: Persona = {
  senderName: "Hanako",
  display: "Hanako",
  callsPerDay: 7,
  scenarios: [
    ["お話", "お腹がすいた", "Meal request around non-meal time.", "Hungry; routine support and hydration suggested.", 1],
    ["お話", "お見舞いの花がきれい", "Positive mood statement.", "Shared a positive comment about visitor flowers.", 1],
    ["お話", "何でもないんだけどね", "Called mainly for social presence.", "No specific medical request; sought company. AI chatted.", 1],
    ["お話", "窓を開けたい", "Room comfort / ventilation request.", "Wanted the window opened.", 1],
    ["お話", "寝返りがうてない", "Position change assistance needed.", "Cannot reposition independently. Pressure-ulcer prevention.", 3],
    ["トイレ", "", "Night restroom call.", "Bathroom assistance requested.", 1],
    ["お話", "咳が止まらない", "Persistent cough.", "Persistent cough; vital signs and respiratory check suggested.", 3],
    ["お話", "吐き気がする", "Nausea complaint.", "Reports nausea. Consider anti-emetic protocol and reassessment.", 3],
    ["お話", "点滴の音が気になる", "Sensory irritation from IV pump.", "Bothered by IV pump sound; AI offered distraction.", 1],
    ["お話", "孫の話をしてもいい？", "Spontaneous social request.", "Wanted to share a story about her grandchild; AI listened.", 1],
  ],
};

const PERSONAS: Persona[] = [KIYOKO, TARO, HANAKO];

const DAY_RANGE_BACK = 14; // 14 days of history
const DAY_RANGE_FORWARD = 0; // no future seeding (looks unnatural otherwise)

// Pseudo-random but deterministic helpers — we want different days to look
// different but the seed to be reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeededCall {
  scenario: Scenario;
  hour: number;
  minute: number;
}

function planResidentDay(persona: Persona, dayOffset: number, residentIdx: number): SeededCall[] {
  // Different seed per (resident, day) so each day is unique but reproducible.
  const rand = mulberry32((dayOffset + 1000) * 17 + residentIdx * 31 + 7);

  // Day-to-day variance: 60% – 140% of mean (clamped to >=2 calls).
  const variance = 0.6 + rand() * 0.8;
  const target = Math.max(2, Math.round(persona.callsPerDay * variance));

  const calls: SeededCall[] = [];
  // Rough hour buckets: morning (6–10), midday (11–14), afternoon (15–18),
  // evening (19–22), late night (23–5). Mostly waking hours; 1 in 5 nights.
  const hourBuckets: Array<[number, number, number]> = [
    [6, 10, 0.30],
    [11, 14, 0.20],
    [15, 18, 0.20],
    [19, 22, 0.20],
    [23, 30, 0.10], // 23–6 next day
  ];

  const usedScenarios = new Set<number>();

  for (let i = 0; i < target; i += 1) {
    // Pick an hour bucket weighted.
    const r = rand();
    let acc = 0;
    let bucket = hourBuckets[0]!;
    for (const b of hourBuckets) {
      acc += b[2];
      if (r <= acc) {
        bucket = b;
        break;
      }
    }
    const rawHour = bucket[0] + Math.floor(rand() * (bucket[1] - bucket[0] + 1));
    const hour = ((rawHour % 24) + 24) % 24;
    const minute = Math.floor(rand() * 60);

    // Prefer unseen scenarios first, then allow repetition.
    let scenarioIdx = Math.floor(rand() * persona.scenarios.length);
    if (usedScenarios.size < persona.scenarios.length) {
      let attempts = 0;
      while (usedScenarios.has(scenarioIdx) && attempts < 6) {
        scenarioIdx = (scenarioIdx + 1) % persona.scenarios.length;
        attempts += 1;
      }
    }
    usedScenarios.add(scenarioIdx);
    const scenario = persona.scenarios[scenarioIdx]!;

    calls.push({ scenario, hour, minute });
  }

  // Sort calls within a day chronologically.
  calls.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return calls;
}

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
  const perResident: Record<string, number> = {};

  for (
    let dayOffset = -DAY_RANGE_BACK;
    dayOffset <= DAY_RANGE_FORWARD;
    dayOffset += 1
  ) {
    PERSONAS.forEach((persona, residentIdx) => {
      const dayPlan = planResidentDay(persona, dayOffset, residentIdx);
      for (const seeded of dayPlan) {
        const [reason, transcript, note, summary, priority] = seeded.scenario;
        const ts = new Date(now);
        ts.setDate(ts.getDate() + dayOffset);
        ts.setHours(seeded.hour, seeded.minute, 0, 0);
        // Skip future timestamps for "today" (so we don't get 2030 entries).
        if (ts.getTime() > now.getTime()) continue;
        const reasonCodes = [reason];
        const docRef = db.collection(collectionName).doc();

        batch.set(docRef, {
          // Canonical fields (for normalized dashboard/family reads).
          reasonCodes,
          note,
          senderName: persona.senderName,
          senderRole: "patient",
          createdAt: Timestamp.fromDate(ts),
          priority,
          aiSummary: summary,
          ...(transcript ? { transcript } : {}),

          // Legacy fields (kept for compatibility).
          理由: reason,
          特記事項: note,
          送信者: persona.senderName,
          送信日時: Timestamp.fromDate(ts),
          ステータス: "未対応",
          要約: summary,
          緊急度: priority,
          認識文: transcript,
          seedTag: SEED_TAG,
          hospitalId,
        });
        seededCount += 1;
        perResident[persona.senderName] =
          (perResident[persona.senderName] ?? 0) + 1;
      }
    });
  }

  await batch.commit();
  return NextResponse.json({
    ok: true,
    seeded: seededCount,
    perResident,
    seedTag: SEED_TAG,
    hospitalId,
    collection: collectionName,
    days: DAY_RANGE_BACK + DAY_RANGE_FORWARD + 1,
    message: `Seeded ${seededCount} demo calls across ${
      DAY_RANGE_BACK + DAY_RANGE_FORWARD + 1
    } days into ${collectionName}. Open /dashboard/nurse, /dashboard/family, /dashboard/history.`,
  });
}
