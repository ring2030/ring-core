/**
 * Shared demo call generation for:
 * - GET /api/dev/seed-demo (manual, SEED_DEMO_SECRET)
 * - GET /api/cron/refresh-demo-calls (Vercel Cron + CRON_SECRET)
 *
 * Only documents carrying these tags are touched by cron / clean —
 * real tablet writes without seedTag are never deleted.
 */
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_HOSPITAL_ID, getCallsCollectionNameForHospital } from "@/lib/auth/hospitalScope";
import {
  DEMO_SEED_TAG,
} from "@/lib/demo/demoSeedTags";

export const BATCH_SIZE = 450;

export type Scenario = [string, string, string, string, number];

interface Persona {
  senderName: string;
  callsPerDay: number;
  pool: Scenario[];
}

const KIYOKO_POOL: Scenario[] = [
  ["お話", "娘の写真もう一回見せてほしいな、さっきも見たけど", "Family photo request (4th today).", "Asking for daughter's photo repeatedly. AI showed photos and shared memories together.", 1],
  ["お話", "息子が今日来るって言ってた気がする、もう夕方だよね？", "Son visit anxiety.", "Asking when her son will arrive. AI gently explained the schedule and reassured her.", 1],
  ["お話", "ここ病院だっけ？ さっきまで家にいた気がして。", "Disorientation — mild.", "Mild disorientation. AI calmly reoriented her and she relaxed.", 2],
  ["お話", "夜中に変な夢を見てね、また同じ夢で怖かったの", "Nightmare; night wake.", "Reported frightening recurring dream. AI listened and helped her feel safe again.", 2],
  ["お話", "胸がギュッてなるの、いつもの薬は飲んだかしら", "Chest tightness — check meds.", "Reports chest tightness. Escalated to nurse; medication check needed.", 4],
  ["お話", "お水ちょうだい、コップ持てなくてこぼしちゃった", "Water + grip difficulty.", "Needed water; dexterity issue noted. AI flagged for nurse.", 2],
  ["お話", "看護師さんありがとうね、いつも優しくしてくれて", "Gratitude expression.", "Expressed sincere gratitude to nursing staff. Positive affect.", 1],
  ["お話", "テレビのあの歌番組、また見たいなあ", "TV nostalgia.", "Wanted to watch an old music show. AI found a similar program for her.", 1],
  ["お話", "今日って何曜日だっけ、月曜と火曜がごっちゃになっちゃう", "Day confusion.", "Confused about the day of week. AI gently clarified and chatted about the day's schedule.", 2],
  ["お話", "毛布がずれちゃって、足先がすごく冷たいの", "Cold feet / blanket.", "Feet cold; blanket had slipped. Staff notified to adjust.", 1],
  ["お話", "お花がきれいだね、誰が持ってきたの？　息子かな", "Visitor flowers.", "Admired flowers; wondering if son brought them. Pleasant social moment.", 1],
  ["お話", "ごはんまだ？ お腹がすいたような気もするけど食べたっけ", "Meal memory.", "Unsure if she ate. AI checked timing and offered a light snack request.", 1],
  ["お話", "薬飲んだかどうかわからなくて、不安なの", "Med adherence doubt.", "Uncertain about medication intake. Chart verification needed.", 3],
  ["お話", "ベッドから起きたい、ちょっと座りたい気分で", "Position change wish.", "Wants to sit up. Assisted mobility flagged for safe transfer.", 2],
  ["お話", "昔働いてた工場の夢を見てね、楽しかったな", "Positive long-term memory.", "Shared fond memory of factory work. AI engaged in reminiscence.", 1],
  ["お話", "廊下に知らない人がいる気がして怖い", "Hallucination concern.", "Reports seeing stranger in hallway. AI stayed calm; nurse alerted.", 3],
  ["トイレ", "トイレ行きたいの、急いで", "Gaze call + verbal.", "Urgent bathroom request via gaze and voice. Assisted promptly.", 1],
  ["トイレ", "また行きたくなっちゃった、ごめんね", "Repeat toileting 40 min.", "Repeated restroom call; fluid balance check recommended.", 2],
  ["トイレ", "夜中なのにごめん、行きたくて", "Night toileting.", "Night restroom; escorted safely.", 1],
];

const TARO_POOL: Scenario[] = [
  ["お話", "左足の筋がこるんだよな、特に夕方から", "Left leg cramp PM.", "Left leg cramping in evenings. AI offered comfort; nurse flagged.", 3],
  ["お話", "また壁に人がいるように見える、夜がこわいんだ", "Visual hallucination Lewy.", "Visual hallucination (person on wall). AI grounded him gently; nurse aware.", 3],
  ["お話", "頭がキーンとして光が眩しい、片頭痛かな", "Headache + photophobia.", "Severe headache with light sensitivity. In-person evaluation recommended.", 4],
  ["お話", "歩こうとしたらよろけて、壁につかまったよ", "Near-fall verbal report.", "Near-fall reported. Mobility safety check urgent.", 4],
  ["お話", "今日が何曜日かわからない、試合の日じゃなかったっけ？", "Temporal disorientation.", "Day confusion. AI gently reoriented.", 2],
  ["お話", "薬の袋がいっぱいあってどれが今日のかわからない", "Polypharmacy confusion.", "Can't identify daily meds. Nurse to verify and organise.", 3],
  ["お話", "寒いのに汗かいてる、なんか変だな", "Dysautonomia signs.", "Cold + sweating simultaneously. Vitals check recommended.", 3],
  ["お話", "テレビの音が大きくて耳鳴りがする", "Noise sensitivity.", "TV too loud; tinnitus complaint. Volume adjusted.", 1],
  ["お話", "夢と現実がごっちゃになる感じがあってね", "Lewy symptom insight.", "Reports dream-reality blending. AI provided empathetic listening.", 2],
  ["お話", "昼寝したらすっきりしたよ、ありがとう", "Post-nap positive.", "Felt refreshed after nap. Positive mood.", 1],
  ["お話", "体がかたくて起き上がれない、手伝ってほしい", "Rigidity AM.", "Morning rigidity; needs transfer help.", 3],
  ["お話", "飲み込みにくくて食事が心配なんだ", "Dysphagia concern.", "Difficulty swallowing; SLP review needed.", 3],
  ["トイレ", "トイレ行きたい、急いでお願い", "Urgency Lewy rigidity.", "Urgent toileting with Lewy-related rigidity. Prompt assist.", 2],
  ["トイレ", "夕方にまたトイレ、体固くて時間かかる", "Evening toileting rigidity.", "Evening bathroom; rigidity slows transfer. Patience needed.", 2],
];

const HANAKO_POOL: Scenario[] = [
  ["お話", "お腹すいた、おやつってまだある？", "Snack request.", "Hungry between meals. Light snack offered per care plan.", 1],
  ["お話", "窓の外の緑がきれい、散歩できるといいな", "Nature appreciation + wish.", "Positive comment on greenery; hopes for a walk.", 1],
  ["お話", "孫に電話したいけど番号覚えてないの", "Family contact.", "Wants to call grandchild; needs phone help.", 2],
  ["お話", "寝返りできなくて腰が痛い、助けて", "Reposition + pain.", "Can't reposition; lower back pain. Pressure ulcer prevention needed.", 3],
  ["お話", "咳が出て止まらない、喉がイガイガする", "Persistent cough.", "Persistent cough; respiratory check and fluids recommended.", 3],
  ["お話", "点滴のポンプの音がカチカチして眠れない", "IV pump noise.", "IV pump noise preventing sleep. AI distracted her; alarm review.", 1],
  ["お話", "お茶もう一杯飲みたい、少しだけでいい", "Tea request.", "Second cup of tea; fluid restriction to be checked.", 1],
  ["お話", "何でもいいから話そうよ、さみしいの", "Loneliness direct.", "Directly expressed loneliness. AI chatted for 10+ min.", 1],
  ["お話", "あの花の名前なんだっけ、あの紫のやつ", "Word-finding difficulty.", "Word-finding difficulty; attempting to name purple flower.", 2],
  ["お話", "吐き気がする、匂いがきつくて気持ち悪い", "Nausea + smell.", "Nausea possibly triggered by smell. Antiemetic protocol considered.", 3],
  ["お話", "肩が凝ってるの、揉んでもらえたらいいんだけど", "Comfort request.", "Shoulder stiffness; comfort care request noted.", 1],
  ["お話", "昨日の夜よく眠れたよ、今日は気分いいの", "Good night sleep.", "Reports good sleep and positive mood. Encouraging sign.", 1],
  ["お話", "昔の話しちゃっていい？ 若い頃のことが浮かぶの", "Reminiscence.", "Wanted to share past memories. AI engaged in life-review conversation.", 1],
  ["お話", "頭がズキンとする、右側だけ", "Right-side headache.", "Right-sided headache. Vascular check; monitor BP.", 3],
  ["トイレ", "夜中にトイレ行きたくなっちゃった", "Night toileting.", "Night restroom call. Safely escorted.", 1],
  ["トイレ", "ごはんの前にトイレ行っておきたい", "Pre-meal toilet.", "Pre-meal restroom routine. Assisted.", 1],
  ["トイレ", "急いで、もう限界かも", "Urgent toileting.", "Urgent restroom; prompt response needed.", 2],
];

const PERSONAS: Persona[] = [
  { senderName: "清子", callsPerDay: 13, pool: KIYOKO_POOL },
  { senderName: "太郎", callsPerDay: 11, pool: TARO_POOL },
  { senderName: "花子", callsPerDay: 14, pool: HANAKO_POOL },
];

const DAY_RANGE_BACK = 21;
const DAY_RANGE_FORWARD = 0;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
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
 * rotationDay: e.g. floor(Date.now() / 86400000) so daily cron changes pick order / counts slightly.
 */
function planDay(persona: Persona, dayOffset: number, idx: number, rotationDay: number): SeededCall[] {
  const rand = mulberry32(dayOffset * 7919 + idx * 104729 + 13 + rotationDay * 10007);
  const variance = 0.55 + rand() * 0.95;
  const target = Math.max(4, Math.round(persona.callsPerDay * variance));

  const chats = persona.pool.filter((s) => s[0] === "お話");
  const toilets = persona.pool.filter((s) => s[0] === "トイレ");

  const buckets: Array<[number, number, number]> = [
    [5, 9, 0.22],
    [9, 12, 0.20],
    [12, 15, 0.18],
    [15, 19, 0.22],
    [19, 23, 0.14],
    [0, 4, 0.04],
  ];

  const calls: SeededCall[] = [];
  for (let i = 0; i < target; i++) {
    const wantChat = rand() < 0.75;
    const pool = wantChat ? chats : toilets;
    const safePool = pool.length ? pool : persona.pool;
    const scenario = safePool[Math.floor(rand() * safePool.length)]!;

    const r = rand();
    let acc = 0;
    let bucket = buckets[0]!;
    for (const b of buckets) {
      acc += b[2];
      if (r <= acc) {
        bucket = b;
        break;
      }
    }

    const span = bucket[1] - bucket[0] + 1;
    const rawH = bucket[0] + Math.floor(rand() * span);
    const h = ((rawH % 24) + 24) % 24;
    const m = (Math.floor(rand() * 60) + i * 17 + idx * 3) % 60;
    const carry = (Math.floor(rand() * 60) + i * 17 + idx * 3) >= 60 ? 1 : 0;
    calls.push({ scenario, hour: (h + carry) % 24, minute: m });
  }
  calls.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return calls;
}

export type PendingDemoWrite = {
  ref: DocumentReference;
  data: Record<string, unknown>;
};

export function getDemoHospitalId(): string {
  return process.env["DEMO_HOSPITAL_ID"]?.trim() || DEFAULT_HOSPITAL_ID;
}

export function getDemoCallsCollectionName(): string {
  return getCallsCollectionNameForHospital(getDemoHospitalId());
}

/** UTC midnight epoch day — changes once per UTC day (cron schedule aligns). */
export function utcRotationDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

export function buildPendingAdminDemoWrites(
  db: Firestore,
  collectionName: string,
  now: Date,
  rotationDay: number,
  seedTag: string = DEMO_SEED_TAG,
): PendingDemoWrite[] {
  const pending: PendingDemoWrite[] = [];
  const hospitalId = getDemoHospitalId();

  for (let day = -DAY_RANGE_BACK; day <= DAY_RANGE_FORWARD; day++) {
    PERSONAS.forEach((persona, pi) => {
      for (const seeded of planDay(persona, day, pi, rotationDay)) {
        const [reason, transcript, note, summary, priority] = seeded.scenario;
        const ts = new Date(now);
        ts.setDate(ts.getDate() + day);
        ts.setHours(seeded.hour, seeded.minute, 0, 0);
        if (ts.getTime() > now.getTime()) continue;

        const tri = transcript.trim();
        pending.push({
          ref: db.collection(collectionName).doc(),
          data: {
            reasonCodes: [reason],
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
            seedTag,
            hospitalId,
          },
        });
      }
    });
  }
  return pending;
}

export async function deleteDemoCallsByTags(
  db: Firestore,
  collectionName: string,
  tags: readonly string[],
): Promise<number> {
  let removed = 0;
  for (const tag of tags) {
    const snap = await db.collection(collectionName).where("seedTag", "==", tag).get();
    const refs = snap.docs.map((d) => d.ref);
    for (let s = 0; s < refs.length; s += BATCH_SIZE) {
      const b = db.batch();
      for (const r of refs.slice(s, s + BATCH_SIZE)) b.delete(r);
      await b.commit();
    }
    removed += refs.length;
  }
  return removed;
}

export async function commitPendingWrites(
  db: Firestore,
  pending: PendingDemoWrite[],
): Promise<void> {
  for (let s = 0; s < pending.length; s += BATCH_SIZE) {
    const b = db.batch();
    for (const p of pending.slice(s, s + BATCH_SIZE)) b.set(p.ref, p.data);
    await b.commit();
  }
}

export function summarizeWeekdays(pending: PendingDemoWrite[]): Record<string, number> {
  const weekdayCounts: Record<string, number> = {};
  for (const p of pending) {
    const ca = p.data["createdAt"] as Timestamp | undefined;
    if (ca && typeof ca.toDate === "function") {
      const d = ca.toDate();
      const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? "?";
      weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;
    }
  }
  return weekdayCounts;
}

export function perResidentCounts(pending: PendingDemoWrite[]): Record<string, number> {
  const perResident: Record<string, number> = {};
  for (const p of pending) {
    const name = String(p.data["senderName"] ?? "");
    perResident[name] = (perResident[name] ?? 0) + 1;
  }
  return perResident;
}
