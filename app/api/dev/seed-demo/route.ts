// app/api/dev/seed-demo/route.ts
//
// Demo data seeder — dense chat transcripts, all weekdays, multi-week history.
// Firestore batches are capped at 500 ops; we chunk commits automatically.
//
// Usage: see README / route comments (?key=SEED_DEMO_SECRET, &action=clean)

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

/** Stay under Firestore 500 writes/batch (leave margin). */
const BATCH_SIZE = 450;

// Each scenario: [reason, transcript, staffNote, aiSummary, priority]
type Scenario = [string, string, string, string, number];

interface Persona {
  senderName: string;
  display: string;
  /** Target mean calls per day (variance applied). */
  callsPerDay: number;
  /** Chat-heavy lines (reason お話 + Japanese transcript). */
  chatPool: Scenario[];
}

const DISORIENTED = [
  " えっ とこはどこ 昨日もここだった？",
  " 娘がさっきまで廊下にいたのに。",
  " もうおうちに帰ったはずなのに。",
  " ごめんね、また同じ話しちゃった？",
];

function withConfusion(base: string, i: number): string {
  const s = DISORIENTED[i % DISORIENTED.length] ?? "";
  if (i % 4 === 0) return `${base}${s}`;
  if (i % 4 === 1) return `${base}… ${s.trim()}`;
  return base;
}

/** Dense reusable chat lines (Japanese) — family / nurse timelines look “alive”. */
function KIYOKO_CHATS(): Scenario[] {
  const lines: Array<[string, string, string, number]> = [
    ["娘の写真、また見せてほしいな", "3rd photo request today.", "Asking for daughter's photo again.", 1],
    ["息子は今日は来るの？ お弁当まだ？", "Visit anxiety.", "Asking when son visits; meal worry.", 1],
    ["夜眠れなくてさ、看護師さんまだいる？", "Night wake; seeks staff.", "Couldn't sleep; asked if nurses are around.", 2],
    ["胸がギュッとなるの いつもの薬まだ？", "Chest tightness — check meds.", "Chest tightness; escalated pattern if persistent.", 4],
    ["ここ病院だよね 駅の改札じゃなかった", "Disorientation mild.", "Mild confusion; AI reoriented gently.", 2],
    ["テレビつけて 昔の歌番組ない？", "TV + nostalgia.", "Wanted TV and old music shows.", 1],
    ["お水ちょうだい カップ持てないの", "Dexterity + thirst.", "Asked for water; grip difficulty noted.", 2],
    ["毛布かけて 足先冷たいの", "Cold feet.", "Cold feet; blanket request.", 1],
    ["お花かわいいね 誰が持ってきたの", "Visitor flowers.", "Commented on flowers; social engagement.", 1],
    ["ありがとうね いつも話聞いてくれて", "Gratitude to AI/staff.", "Thanked listener; positive affect.", 1],
    ["顔洗いたい 洗面所連れてって", "ADL request.", "Wants to wash face; escort request.", 2],
    ["もうすぐごはん？ お腹すいた気もする", "Meal timing.", "Asked about meal; hunger cues mixed.", 1],
    ["薬飲んだか忘れちゃった", "Med memory.", "Unsure if dose taken; needs chart check.", 3],
    ["ベッドから起きたい ちょっと座りたい", "Mobility.", "Wants to sit up; mobility assist.", 3],
  ];
  let i = 0;
  return lines.map(([t, note, sum, p]) => {
    const tr = withConfusion(t, i);
    i += 1;
    return ["お話", tr, note, sum, p] as Scenario;
  });
}

function TARO_CHATS(): Scenario[] {
  const lines: Array<[string, string, string, number]> = [
    ["足の筋がこるんだ 左だけ", "Leg cramp left.", "Left leg cramping; monitor neuro.", 3],
    ["また壁に人がいるんだけど…", "Hallucination Lewy.", "Hallucination; grounded calmly.", 3],
    ["頭がキーンとする 明るいとまし", "Headache + light.", "Headache photophobia; assess.", 3],
    ["トイレ急いで もう我慢できない", "Urgent toileting verbal.", "Urgent restroom; assist fast.", 2],
    ["今日何曜日？ 試合の日じゃなかった？", "Temporal confusion.", "Day-of-week confusion; gentle correction.", 2],
    ["テレビの音小さくして 耳鳴りする", "Sensory TV.", "TV too loud vs tinnitus.", 1],
    ["歩こうとしたらよろけた", "Near-fall verbal.", "Reported stumble; safety check.", 4],
    ["薬の袋どれかわからない", "Polypharmacy confusion.", "Med bag confusion; nurse verify.", 3],
    ["寒い でも汗かいてる", "Autonomic ?", "Cold + sweat; vitals.", 3],
    ["夢と現実が入り混じるね", "Lewy insight fragment.", "Reality mixing; supportive listening.", 2],
  ];
  let i = 0;
  return lines.map(([t, note, sum, p]) => {
    const tr = withConfusion(t, i + 2);
    i += 1;
    return ["お話", tr, note, sum, p] as Scenario;
  });
}

function HANAKO_CHATS(): Scenario[] {
  const lines: Array<[string, string, string, number]> = [
    ["お腹すいた おやつまだ？", "Snack timing.", "Hungry; snack timing.", 1],
    ["窓の外の木、緑がきれい", "Pleasant observation.", "Positive environmental comment.", 1],
    ["孫に電話したい 番号わからないの", "Family phone.", "Wants grandchild call; needs help dialing.", 2],
    ["寝返りうてない 腰いたい", "Reposition.", "Can't turn; sacral pain.", 3],
    ["咳ふかせて 喉かわいた", "Cough + thirst.", "Cough; offer fluids per protocol.", 2],
    ["点滴のカチカチ音、イライラする", "Pump noise.", "IV pump annoying; distraction.", 1],
    ["お茶もう一杯 ほんの少しでいい", "Tea request.", "Second cup tea; fluid restriction check.", 1],
    ["今日はお日様いいね お散歩いける？", "Sun + mobility hope.", "Nice day; asked about walk.", 1],
    ["何でもいいから話そ さみしいの", "Loneliness direct.", "Expresses loneliness; prolonged chat.", 1],
    ["花の名前なんだっけ 鮮やかで", "Cognition flower.", "Word-finding for flower name.", 1],
    ["吐き気する 匂いきついかも", "Nausea + smell.", "Nausea; assess antiemetic.", 3],
    ["肩揉んでほしいって言ったけど悪い？", "Comfort ask.", "Asked massage; boundaries / staff.", 2],
  ];
  let i = 0;
  return lines.map(([t, note, sum, p]) => {
    const tr = withConfusion(t, i + 5);
    i += 1;
    return ["お話", tr, note, sum, p] as Scenario;
  });
}

const TOILET_PHRASES = [
  "トイレ行きたいの、早く",
  "お手洗い連れてって",
  "もう我慢できないよ",
  "トイレ途中で息切れしちゃって",
  "すぐトイレつれて",
] as const;

function toiletScenario(
  phraseIndex: number,
  note: string,
  summary: string,
  priority: number,
): Scenario {
  const t = TOILET_PHRASES[phraseIndex % TOILET_PHRASES.length] ?? "トイレいきたい";
  return ["トイレ", t, note, summary, priority];
}

const KIYOKO: Persona = {
  senderName: "Kiyoko",
  display: "Kiyoko",
  callsPerDay: 12,
  chatPool: [
    ...KIYOKO_CHATS(),
    toiletScenario(0, "Gaze toilet.", "Bathroom assistance with gaze call.", 1),
    toiletScenario(1, "Repeat restroom 45min.", "Repeated toileting; check fluid balance.", 2),
    toiletScenario(2, "Night toilet.", "Night restroom escort.", 1),
  ],
};

const TARO: Persona = {
  senderName: "Taro",
  display: "Taro",
  callsPerDay: 11,
  chatPool: [
    ...TARO_CHATS(),
    toiletScenario(2, "Rigidity / urgent.", "Urgent toileting Lewy.", 2),
    toiletScenario(3, "Evening toilet.", "Evening bathroom assist.", 1),
  ],
};

const HANAKO: Persona = {
  senderName: "Hanako",
  display: "Hanako",
  callsPerDay: 13,
  chatPool: [
    ...HANAKO_CHATS(),
    toiletScenario(4, "Night round.", "Night restroom.", 1),
    toiletScenario(0, "Pre-meal toilet.", "Before meal bathroom.", 1),
  ],
};

const PERSONAS: Persona[] = [KIYOKO, TARO, HANAKO];

/** ~3 weeks back so family “Past 7 days” + history always have variety. */
const DAY_RANGE_BACK = 21;
const DAY_RANGE_FORWARD = 0;

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

/**
 * ~72% of picks are お話 (chat transcript demo); rest toileting with voice line.
 * Per-day RNG spreads hours so the same wall-clock doesn’t land every day.
 */
function planResidentDay(persona: Persona, dayOffset: number, residentIdx: number): SeededCall[] {
  const rand = mulberry32(dayOffset * 7919 + residentIdx * 104729 + 13);

  const variance = 0.55 + rand() * 0.95;
  const target = Math.max(4, Math.round(persona.callsPerDay * variance));

  const chats = persona.chatPool.filter((s) => s[0] === "お話");
  const toilets = persona.chatPool.filter((s) => s[0] === "トイレ");

  const hourBuckets: Array<[number, number, number]> = [
    [5, 9, 0.22],
    [9, 12, 0.20],
    [12, 15, 0.18],
    [15, 19, 0.22],
    [19, 23, 0.14],
    [0, 4, 0.04],
  ];

  const calls: SeededCall[] = [];

  for (let i = 0; i < target; i += 1) {
    const wantChat = rand() < 0.72;
    const pool = wantChat ? chats : toilets;
    const safePool = pool.length ? pool : persona.chatPool;
    const scenarioIdx = Math.floor(rand() * safePool.length);
    const scenario = safePool[scenarioIdx]!;

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
    const span = bucket[1] - bucket[0] + 1;
    const rawHour = bucket[0] + Math.floor(rand() * span);
    const hour = ((rawHour % 24) + 24) % 24;
    const minute = Math.floor(rand() * 60);
    const jitterMin = (i * 17 + residentIdx * 3 + dayOffset) % 7;
    const m = (minute + jitterMin) % 60;
    const hcarry = minute + jitterMin >= 60 ? 1 : 0;
    const h = (hour + hcarry) % 24;

    calls.push({ scenario, hour: h, minute: m });
  }

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

    const refs = snap.docs.map((d) => d.ref);
    for (let start = 0; start < refs.length; start += BATCH_SIZE) {
      const batch = db.batch();
      for (const ref of refs.slice(start, start + BATCH_SIZE)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
    return NextResponse.json({ ok: true, removed: refs.length });
  }

  if (action !== "seed") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const now = new Date();

  const pending: Array<{ ref: ReturnType<ReturnType<typeof db.collection>["doc"]>; data: Record<string, unknown> }> =
    [];

  const weekdayCounts: Record<string, number> = {};

  for (let dayOffset = -DAY_RANGE_BACK; dayOffset <= DAY_RANGE_FORWARD; dayOffset += 1) {
    PERSONAS.forEach((persona, residentIdx) => {
      const dayPlan = planResidentDay(persona, dayOffset, residentIdx);
      for (const seeded of dayPlan) {
        const [reason, transcript, note, summary, priority] = seeded.scenario;
        const ts = new Date(now);
        ts.setDate(ts.getDate() + dayOffset);
        ts.setHours(seeded.hour, seeded.minute, 0, 0);
        if (ts.getTime() > now.getTime()) continue;

        const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][ts.getDay()] ?? "?";
        weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;

        const reasonCodes = [reason];
        const docRef = db.collection(collectionName).doc();
        const tri = transcript.trim();
        pending.push({
          ref: docRef,
          data: {
            reasonCodes,
            note,
            senderName: persona.senderName,
            senderRole: "patient",
            createdAt: Timestamp.fromDate(ts),
            priority,
            aiSummary: summary,
            ...(tri ? { transcript: tri } : {}),
            理由: reason,
            特記事項: note,
            送信者: persona.senderName,
            送信日時: Timestamp.fromDate(ts),
            ステータス: "未対応",
            要約: summary,
            緊急度: priority,
            認識文: tri,
            seedTag: SEED_TAG,
            hospitalId,
          },
        });
      }
    });
  }

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = db.batch();
    for (const p of pending.slice(start, start + BATCH_SIZE)) {
      batch.set(p.ref, p.data);
    }
    await batch.commit();
  }

  const perResident: Record<string, number> = {};
  for (const p of pending) {
    const name = String(p.data["senderName"] ?? "");
    perResident[name] = (perResident[name] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    seeded: pending.length,
    perResident,
    weekdayBreakdown: weekdayCounts,
    seedTag: SEED_TAG,
    hospitalId,
    collection: collectionName,
    days: DAY_RANGE_BACK + DAY_RANGE_FORWARD + 1,
    message: `Seeded ${pending.length} demo calls (${Object.keys(weekdayCounts).length} weekdays hit) into ${collectionName}. Chat-heavy. Re-run clean first if replacing an older seed.`,
  });
}
