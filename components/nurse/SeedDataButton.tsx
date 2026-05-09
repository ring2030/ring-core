"use client";

import { useState } from "react";
import {
  writeBatch,
  doc,
  collection,
  Timestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { DatabaseZap, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { getFirestoreDb } from "@/lib/firebase";
import {
  getCallsCollectionNameForCurrentHospital,
  getCurrentHospitalIdFromCookie,
} from "@/lib/auth/clientHospital";
import { UI_DEMO_SEED_TAG } from "@/lib/demo/demoSeedTags";

// ─── シナリオ定義 ──────────────────────────────────────────────────────────────
// [reasonCode, transcript（日本語発話）, aiSummary（英語）, priority, senderName]
type Scene = [string, string, string, number, string];

const SCENES: Scene[] = [
  // 清子 — お話
  ["お話", "娘の写真もう一回見せてほしいな", "Patient asked for daughter's photo again. AI showed and reminisced together.", 1, "清子"],
  ["お話", "息子は今日来るって言ってたよね、もう夕方だけど", "Asking about son's visit; time disorientation. AI reassured gently.", 1, "清子"],
  ["お話", "ここ病院だっけ？ さっきまで家にいた気がして", "Mild disorientation. AI reoriented calmly; patient relaxed.", 2, "清子"],
  ["お話", "夜中に怖い夢を見た、また同じ夢なの", "Frightening recurring dream. AI listened and offered reassurance.", 2, "清子"],
  ["お話", "胸がギュッてなる、いつもの薬は飲んだかしら", "Chest tightness + medication uncertainty. Escalated to nurse.", 4, "清子"],
  ["お話", "テレビの歌番組また見たいなあ", "Wanted to watch old music show. AI arranged distraction.", 1, "清子"],
  ["お話", "今日って何曜日だっけ、月曜と火曜がごっちゃで", "Day-of-week confusion. AI gently clarified the schedule.", 2, "清子"],
  ["お話", "看護師さんいつも優しくしてくれてありがとう", "Expressed sincere gratitude to nursing staff.", 1, "清子"],
  ["お話", "お水ちょうだい、コップ持てなくてこぼしちゃった", "Needed water; grip difficulty noted. Flagged for nurse.", 2, "清子"],
  ["お話", "毛布がずれて足先が冷たい", "Feet cold; blanket shifted. Staff adjusted.", 1, "清子"],
  ["お話", "廊下に知らない人が見える気がして怖い", "Reports seeing stranger in hallway. AI stayed calm; nurse alerted.", 3, "清子"],
  ["お話", "娘のこと話してもいい？ 最近会ってないから", "Wanted to talk about daughter. Emotional support conversation.", 1, "清子"],
  ["お話", "薬飲んだかどうかわからなくて不安", "Uncertain about medication. Chart verification needed.", 3, "清子"],
  ["お話", "昔ね、工場で働いてたころが楽しかった", "Positive long-term memory shared. Reminiscence session.", 1, "清子"],
  // 清子 — トイレ
  ["トイレ", "トイレ行きたいの、急いで", "Urgent restroom via gaze and voice. Assisted promptly.", 1, "清子"],
  ["トイレ", "また行きたくなっちゃった、ごめんね", "Repeat restroom call 40 min later; fluid balance check.", 2, "清子"],
  ["トイレ", "夜中なのにごめん、行きたくて", "Night restroom; escorted safely.", 1, "清子"],

  // 太郎 — お話
  ["お話", "左足の筋がこるんだよ、夕方からずっと", "Left leg cramping since evening. Comfort given; nurse flagged.", 3, "太郎"],
  ["お話", "また壁に人がいるように見える、夜がこわい", "Visual hallucination (Lewy). Grounded calmly; nurse aware.", 3, "太郎"],
  ["お話", "頭がキーンとして光が眩しい", "Severe headache + photophobia. In-person eval recommended.", 4, "太郎"],
  ["お話", "歩こうとしたらよろけて壁につかまったよ", "Near-fall. Mobility safety check urgent.", 4, "太郎"],
  ["お話", "薬の袋がいっぱいあってどれが今日のかわからない", "Can't identify daily meds. Nurse to verify.", 3, "太郎"],
  ["お話", "寒いのに汗かいてる、なんか変だな", "Cold + sweating simultaneously. Vitals check recommended.", 3, "太郎"],
  ["お話", "夢と現実がごっちゃになる感じがある", "Reports dream-reality blending. Empathetic listening.", 2, "太郎"],
  ["お話", "体がかたくて起き上がれない、手伝ってほしい", "Morning rigidity; needs transfer help.", 3, "太郎"],
  ["お話", "飲み込みにくくて食事が心配なんだ", "Dysphagia concern. SLP review needed.", 3, "太郎"],
  ["お話", "昼寝したらすっきりしたよ、ありがとう", "Felt refreshed after nap. Positive mood.", 1, "太郎"],
  // 太郎 — トイレ
  ["トイレ", "トイレ行きたい、急いでお願い", "Urgent toileting with Lewy-related rigidity.", 2, "太郎"],
  ["トイレ", "夕方にまたトイレ、体固くて時間かかる", "Evening bathroom; rigidity. Patience needed.", 2, "太郎"],

  // 花子 — お話
  ["お話", "お腹すいた、おやつってまだある？", "Hungry between meals. Light snack offered per care plan.", 1, "花子"],
  ["お話", "窓の外の緑がきれい、散歩できるといいな", "Positive comment on nature; hope for a walk.", 1, "花子"],
  ["お話", "孫に電話したいけど番号覚えてないの", "Wants to call grandchild; needs phone help.", 2, "花子"],
  ["お話", "寝返りできなくて腰が痛い、助けて", "Can't reposition; lower back pain. Pressure ulcer prevention.", 3, "花子"],
  ["お話", "咳が出て止まらない、喉がイガイガする", "Persistent cough; respiratory check recommended.", 3, "花子"],
  ["お話", "点滴のポンプの音がカチカチして眠れない", "IV pump noise preventing sleep. Distracted; alarm review.", 1, "花子"],
  ["お話", "何でもいいから話そうよ、さみしいの", "Directly expressed loneliness. AI chatted for 10+ min.", 1, "花子"],
  ["お話", "吐き気がする、匂いがきつくて気持ち悪い", "Nausea triggered by smell. Antiemetic considered.", 3, "花子"],
  ["お話", "昔の話しちゃっていい？ 若い頃のことが浮かぶの", "Wanted to share past memories. Life-review conversation.", 1, "花子"],
  ["お話", "頭がズキンとする、右側だけ痛い", "Right-sided headache. Monitor BP; vascular check.", 3, "花子"],
  ["お話", "今日はお日様いいね、気分上がるな", "Positive mood on sunny day. Joyful social interaction.", 1, "花子"],
  // 花子 — トイレ
  ["トイレ", "夜中にトイレ行きたくなっちゃった", "Night restroom call. Safely escorted.", 1, "花子"],
  ["トイレ", "ごはんの前にトイレ行っておきたい", "Pre-meal restroom routine. Assisted.", 1, "花子"],
  ["トイレ", "急いで、もう限界かも", "Urgent restroom; prompt response needed.", 2, "花子"],
];

// 時間帯の重み: 早朝〜深夜
const HOUR_WEIGHTS = [
  1, 1, 1, 2, 2, 4,  // 0–5
  7, 9, 9, 8, 8, 9,  // 6–11
  8, 8, 9, 9, 8, 8,  // 12–17
  8, 7, 6, 5, 4, 2,  // 18–23
];

function weightedHour(): number {
  const total = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < 24; i++) {
    r -= HOUR_WEIGHTS[i] ?? 0;
    if (r <= 0) return i;
  }
  return 9;
}

function randomTs(daysAgo: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(weightedHour(), Math.floor(Math.random() * 60), 0, 0);
  // 未来にならないよう今より過去に補正
  if (d.getTime() > Date.now()) d.setHours(d.getHours() - 1);
  return Timestamp.fromDate(d);
}

function buildDoc(ts: Timestamp, scene: Scene) {
  const [reason, transcript, summary, priority, senderName] = scene;
  const tri = transcript.trim();
  return {
    reasonCodes: [reason],
    note: "",
    senderName,
    senderRole: "patient" as const,
    createdAt: ts,
    priority,
    aiSummary: summary,
    ...(tri ? { transcript: tri } : {}),
    seedTag: UI_DEMO_SEED_TAG,
    hospitalId: getCurrentHospitalIdFromCookie(),
    // legacy compat
    理由: reason,
    特記事項: "",
    送信者: senderName,
    送信日時: ts,
    緊急度: priority,
    要約: summary,
    認識文: tri,
  };
}

type Status = "idle" | "seeding" | "done" | "deleting" | "error";

export default function SeedDataButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const seed = async () => {
    setStatus("seeding");
    setProgress(0);
    setMessage("生成中…");

    try {
      const db = getFirestoreDb();
      const col = getCallsCollectionNameForCurrentHospital();

      // 21日分 × 各日ランダムに SCENES からピック（1日 12〜18 件）
      const entries: { ts: Timestamp; scene: Scene }[] = [];
      for (let daysAgo = 21; daysAgo >= 0; daysAgo--) {
        const count = 12 + Math.floor(Math.random() * 7); // 12〜18
        for (let i = 0; i < count; i++) {
          const scene = SCENES[Math.floor(Math.random() * SCENES.length)]!;
          entries.push({ ts: randomTs(daysAgo), scene });
        }
      }

      const CHUNK = 450;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const { ts, scene } of entries.slice(i, i + CHUNK)) {
          batch.set(doc(collection(db, col)), buildDoc(ts, scene));
        }
        await batch.commit();
        setProgress(Math.round(((i + Math.min(CHUNK, entries.length - i)) / entries.length) * 100));
      }

      setStatus("done");
      setMessage(`✅ ${entries.length} 件を追加しました`);
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setMessage(`❌ ${msg}`);
    }
  };

  const deleteTaggedDemo = async () => {
    if (
      !confirm(
        "⚠️ DEVボタンで入れたデモ（seedTag）だけを削除します。実機のコールは残ります。よろしいですか？",
      )
    )
      return;
    setStatus("deleting");
    setMessage("削除中…");
    try {
      const db = getFirestoreDb();
      const col = getCallsCollectionNameForCurrentHospital();
      const snap = await getDocs(
        query(collection(db, col), where("seedTag", "==", UI_DEMO_SEED_TAG)),
      );
      const CHUNK = 450;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        setProgress(
          snap.docs.length
            ? Math.round(((i + CHUNK) / snap.docs.length) * 100)
            : 100,
        );
      }
      setStatus("done");
      setMessage(`🗑️ UIデモ ${snap.docs.length} 件を削除しました`);
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setMessage(`❌ ${msg}`);
    }
  };

  const busy = status === "seeding" || status === "deleting";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-1.5 text-[10px] font-black text-stone-400 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-500"
      >
        <DatabaseZap className="h-3 w-3" />
        DEV
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-violet-700">
            <DatabaseZap className="h-3.5 w-3.5" />
            デモデータ（21日分 / 3名 / 日本語会話）
          </p>
          <p className="mb-3 text-[10px] leading-snug text-stone-500">
            投入データには <code className="rounded bg-stone-100 px-0.5">seedTag</code> が付きます。
            毎日の自動更新（Vercel Cron）はタグ付きデモだけ差し替えます。実機の記録は消しません。
          </p>
          {(busy || status === "done" || status === "error") && (
            <div className="mb-3">
              {busy && (
                <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {message && (
                <p className="rounded-xl bg-stone-50 px-3 py-2 text-[10px] text-stone-600">{message}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={seed}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-violet-600 active:scale-95 disabled:opacity-50"
            >
              {status === "seeding" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中…</>
              ) : status === "done" ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> 完了</>
              ) : (
                <><DatabaseZap className="h-3.5 w-3.5" /> 21日分を投入</>
              )}
            </button>

            <button
              onClick={deleteTaggedDemo}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
            >
              {status === "deleting" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 削除中…</>
              ) : (
                <><Trash2 className="h-3.5 w-3.5" /> UIデモのみ削除</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
