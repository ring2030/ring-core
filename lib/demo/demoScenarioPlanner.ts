/**
 * Client-safe demo scenario + timestamp planning (no firebase-admin).
 */
import {
  applyTimeOnBase,
  applyTimeOnOffset,
  clusterCalendarBases,
  lightDayOffsets,
} from "@/lib/demo/demoDateDistribution";

export type Scenario = [string, string, string, string, number];

interface Persona {
  senderName: string;
  callsPerDay: number;
  pool: Scenario[];
}

const KIYOKO_POOL: Scenario[] = [
  ["お話", "娘の写真、もう一回見せてほしいな、さっき見たけどね", "Family photo request (4th today).", "Asking for daughter's photo again. AI showed photos and shared memories together.", 1],
  ["お話", "息子、今日来るって言ってたよね、もう夕方なのに", "Son visit anxiety.", "Asking when her son will arrive. AI gently explained the schedule and reassured her.", 1],
  ["お話", "ここ病院だっけ？さっきまで家にいた気がして", "Disorientation — mild.", "Mild disorientation. AI calmly reoriented her and she relaxed.", 2],
  ["お話", "夜中に変な夢見ちゃって、また同じ夢で怖かったの", "Nightmare; night wake.", "Reported frightening recurring dream. AI listened and helped her feel safe again.", 2],
  ["お話", "胸がギュッてなるの、いつもの薬飲んだかしら", "Chest tightness — check meds.", "Reports chest tightness. Escalated to nurse; medication check needed.", 4],
  ["お話", "お水ちょうだい、コップ持てなくてこぼしちゃった", "Water + grip difficulty.", "Needed water; dexterity issue noted. AI flagged for nurse.", 2],
  ["お話", "看護師さん、いつも優しくしてくれてありがとうね", "Gratitude expression.", "Expressed sincere gratitude to nursing staff. Positive affect.", 1],
  ["お話", "テレビのあの歌番組、また見たいなあ", "TV nostalgia.", "Wanted to watch an old music show. AI found a similar program for her.", 1],
  ["お話", "今日って何曜日だっけ、月曜と火曜がごっちゃで", "Day confusion.", "Confused about the day of week. AI gently clarified and chatted about the day's schedule.", 2],
  ["お話", "毛布ずれちゃって、足先すごく冷たいの", "Cold feet / blanket.", "Feet cold; blanket had slipped. Staff notified to adjust.", 1],
  ["お話", "お花きれいだね、誰が持ってきたの、息子かな", "Visitor flowers.", "Admired flowers; wondering if son brought them. Pleasant social moment.", 1],
  ["お話", "ごはんまだ？お腹すいた気もするけど食べたっけ", "Meal memory.", "Unsure if she ate. AI checked timing and offered a light snack request.", 1],
  ["お話", "薬飲んだかどうかわからなくて、不安なの", "Med adherence doubt.", "Uncertain about medication intake. Chart verification needed.", 3],
  ["お話", "ベッドから起きたいの、ちょっと座りたい気分", "Position change wish.", "Wants to sit up. Assisted mobility flagged for safe transfer.", 2],
  ["お話", "昔働いてた工場の夢見てね、楽しかったな", "Positive long-term memory.", "Shared fond memory of factory work. AI engaged in reminiscence.", 1],
  ["お話", "廊下に知らない人いる気がして、怖いの", "Hallucination concern.", "Reports seeing stranger in hallway. AI stayed calm; nurse alerted.", 3],
  ["トイレ", "トイレ行きたいの、急いで", "Gaze call + verbal.", "Urgent bathroom request via gaze and voice. Assisted promptly.", 1],
  ["トイレ", "また行きたくなっちゃった、ごめんね", "Repeat toileting 40 min.", "Repeated restroom call; fluid balance check recommended.", 2],
  ["トイレ", "夜中なのにごめん、行きたくて", "Night toileting.", "Night restroom; escorted safely.", 1],
];

const TARO_POOL: Scenario[] = [
  ["お話", "左足の筋がこるんだよ、夕方からずっと", "Left leg cramp PM.", "Left leg cramping in evenings. AI offered comfort; nurse flagged.", 3],
  ["お話", "また壁に人がいるように見える、夜がこわい", "Visual hallucination Lewy.", "Visual hallucination (person on wall). AI grounded him gently; nurse aware.", 3],
  ["お話", "頭がキーンとして光がまぶしい", "Headache + photophobia.", "Severe headache with light sensitivity. In-person evaluation recommended.", 4],
  ["お話", "歩こうとしたらよろけて、壁につかまったよ", "Near-fall verbal report.", "Near-fall reported. Mobility safety check urgent.", 4],
  ["お話", "今日何曜日かわからない、試合の日じゃなかったっけ", "Temporal disorientation.", "Day confusion. AI gently reoriented.", 2],
  ["お話", "薬の袋いっぱいあって、どれが今日のかわからない", "Polypharmacy confusion.", "Can't identify daily meds. Nurse to verify and organise.", 3],
  ["お話", "寒いのに汗かいてる、なんか変だな", "Dysautonomia signs.", "Cold + sweating simultaneously. Vitals check recommended.", 3],
  ["お話", "テレビの音大きくて、耳鳴りする", "Noise sensitivity.", "TV too loud; tinnitus complaint. Volume adjusted.", 1],
  ["お話", "夢と現実がごっちゃになる感じがある", "Lewy symptom insight.", "Reports dream-reality blending. AI provided empathetic listening.", 2],
  ["お話", "昼寝したらすっきりした、ありがとう", "Post-nap positive.", "Felt refreshed after nap. Positive mood.", 1],
  ["お話", "体がかたくて起き上がれない、手伝って", "Rigidity AM.", "Morning rigidity; needs transfer help.", 3],
  ["お話", "飲み込みにくくて、食事が心配", "Dysphagia concern.", "Difficulty swallowing; SLP review needed.", 3],
  ["トイレ", "トイレ行きたい、急いでお願い", "Urgency Lewy rigidity.", "Urgent toileting with Lewy-related rigidity. Prompt assist.", 2],
  ["トイレ", "夕方またトイレ、体固くて時間かかる", "Evening toileting rigidity.", "Evening bathroom; rigidity slows transfer. Patience needed.", 2],
];

const HANAKO_POOL: Scenario[] = [
  ["お話", "お腹すいた、おやつまだある？", "Snack request.", "Hungry between meals. Light snack offered per care plan.", 1],
  ["お話", "窓の外の緑きれい、散歩できたらいいな", "Nature appreciation + wish.", "Positive comment on greenery; hopes for a walk.", 1],
  ["お話", "孫に電話したい、番号覚えてないの", "Family contact.", "Wants to call grandchild; needs phone help.", 2],
  ["お話", "寝返りできなくて腰が痛い、助けて", "Reposition + pain.", "Can't reposition; lower back pain. Pressure ulcer prevention needed.", 3],
  ["お話", "咳が出て止まらない、喉イガイガする", "Persistent cough.", "Persistent cough; respiratory check and fluids recommended.", 3],
  ["お話", "点滴のポンプカチカチして、眠れない", "IV pump noise.", "IV pump noise preventing sleep. AI distracted her; alarm review.", 1],
  ["お話", "お茶もう一杯、少しだけでいい", "Tea request.", "Second cup of tea; fluid restriction to be checked.", 1],
  ["お話", "何でもいいから話そう、さみしいの", "Loneliness direct.", "Directly expressed loneliness. AI chatted for 10+ min.", 1],
  ["お話", "あの花の名前なんだっけ、紫のやつ", "Word-finding difficulty.", "Word-finding difficulty; attempting to name purple flower.", 2],
  ["お話", "吐き気する、匂いきつくて気持ち悪い", "Nausea + smell.", "Nausea possibly triggered by smell. Antiemetic protocol considered.", 3],
  ["お話", "肩凝ってる、揉んでもらえたらいいんだけど", "Comfort request.", "Shoulder stiffness; comfort care request noted.", 1],
  ["お話", "昨日の夜よく眠れた、今日気分いい", "Good night sleep.", "Reports good sleep and positive mood. Encouraging sign.", 1],
  ["お話", "昔の話していい？若い頃のことが浮かぶ", "Reminiscence.", "Wanted to share past memories. AI engaged in life-review conversation.", 1],
  ["お話", "頭ズキンとする、右側だけ痛い", "Right-side headache.", "Right-sided headache. Vascular check; monitor BP.", 3],
  ["トイレ", "夜中トイレ行きたくなっちゃった", "Night toileting.", "Night restroom call. Safely escorted.", 1],
  ["トイレ", "ごはんの前にトイレ行っておきたい", "Pre-meal toilet.", "Pre-meal restroom routine. Assisted.", 1],
  ["トイレ", "急いで、もう限界かも", "Urgent toileting.", "Urgent restroom; prompt response needed.", 2],
];

const PERSONAS: Persona[] = [
  { senderName: "清子", callsPerDay: 13, pool: KIYOKO_POOL },
  { senderName: "太郎", callsPerDay: 11, pool: TARO_POOL },
  { senderName: "花子", callsPerDay: 14, pool: HANAKO_POOL },
];

const CLUSTER_DAY_DENSITY = 2.75;
const LIGHT_DAY_DENSITY = 0.16;

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

function planDay(
  persona: Persona,
  dayOffset: number,
  idx: number,
  rotationDay: number,
  density = 1,
): SeededCall[] {
  const rand = mulberry32(dayOffset * 7919 + idx * 104729 + 13 + rotationDay * 10007);
  const variance = 0.55 + rand() * 0.95;
  const target = Math.max(3, Math.round(persona.callsPerDay * variance * density));

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

export type DemoEntryPlan = {
  at: Date;
  scenario: Scenario;
  senderName: string;
};

export function utcRotationDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** May 17–18 に多く、それ以外の日（例: 5/10）は少量。 */
export function planDemoEntries(now: Date, rotationDay: number): DemoEntryPlan[] {
  const entries: DemoEntryPlan[] = [];

  for (const base of clusterCalendarBases(now)) {
    PERSONAS.forEach((persona, pi) => {
      for (const seeded of planDay(persona, 0, pi, rotationDay, CLUSTER_DAY_DENSITY)) {
        const ts = applyTimeOnBase(base, seeded.hour, seeded.minute, now);
        if (!ts) continue;
        entries.push({ at: ts, scenario: seeded.scenario, senderName: persona.senderName });
      }
    });
  }

  for (const day of lightDayOffsets(now)) {
    PERSONAS.forEach((persona, pi) => {
      for (const seeded of planDay(persona, day, pi, rotationDay, LIGHT_DAY_DENSITY)) {
        const ts = applyTimeOnOffset(now, day, seeded.hour, seeded.minute);
        if (!ts) continue;
        entries.push({ at: ts, scenario: seeded.scenario, senderName: persona.senderName });
      }
    });
  }

  return entries;
}
