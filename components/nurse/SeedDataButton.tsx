"use client";

import { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, writeBatch, doc, collection, Timestamp } from "firebase/firestore";
import { DatabaseZap, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import {
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore";

// ─── Firebase ──────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ─── シードデータテンプレート ──────────────────────────────────────────────

interface Template {
  理由: string;
  緊急度: number;
  要約: string;
  特記事項: string;
  送信者: string;
}

const TEMPLATES: Template[] = [
  // ── 緊急度 1：記録のみ（挨拶・世間話） ────────────────────────────────
  { 理由: "お話", 緊急度: 1, 要約: "日常会話・様子見",                      特記事項: "AI会話開始",        送信者: "きよ子" },
  { 理由: "お話", 緊急度: 1, 要約: "昔の思い出話・穏やかな様子",             特記事項: "AI会話開始",        送信者: "きよ子" },
  { 理由: "お話", 緊急度: 1, 要約: "好きな演歌の話で盛り上がる",             特記事項: "AI会話開始",        送信者: "きよ子" },
  { 理由: "お話", 緊急度: 1, 要約: "孫の話・嬉しそうな様子",                 特記事項: "AI会話開始",        送信者: "アライキヨコ" },

  // ── 緊急度 2：経過観察（寂しい・眠れない） ────────────────────────────
  { 理由: "寂しい", 緊急度: 2, 要約: "寂しさ・孤独感の訴え。傾聴を希望",     特記事項: "AI会話開始",        送信者: "きよ子" },
  { 理由: "眠れない", 緊急度: 2, 要約: "不眠の訴え。夜間の不安感あり",       特記事項: "AI会話開始",        送信者: "きよ子" },
  { 理由: "不安", 緊急度: 2, 要約: "漠然とした不安の訴え・精神的サポート必要", 特記事項: "AI会話開始",        送信者: "アライキヨコ" },
  { 理由: "寂しい", 緊急度: 2, 要約: "家族に会いたいと涙ながらに訴え",       特記事項: "AI会話開始",        送信者: "ムラセタロウ" },

  // ── 緊急度 3：通常対応（水・薬・体位） ────────────────────────────────
  { 理由: "水が欲しい",    緊急度: 3, 要約: "水分補給の希望",                  特記事項: "",                  送信者: "きよ子" },
  { 理由: "薬が欲しい",    緊急度: 3, 要約: "頓服薬の希望。痛みの訴えあり",    特記事項: "",                  送信者: "きよ子" },
  { 理由: "トイレ",        緊急度: 3, 要約: "排泄の介助を希望",                特記事項: "視線入力からの自動送信", 送信者: "きよ子" },
  { 理由: "体位を変えて",  緊急度: 3, 要約: "体位変換の介助依頼",              特記事項: "",                  送信者: "アライキヨコ" },
  { 理由: "寒い",          緊急度: 3, 要約: "保温の希望。毛布の追加を求める",  特記事項: "",                  送信者: "ムラセタロウ" },
  { 理由: "お腹が空いた",  緊急度: 3, 要約: "空腹の訴え。食事時間外の希望",   特記事項: "",                  送信者: "アライキヨコ" },

  // ── 緊急度 4：急ぎ対応 ────────────────────────────────────────────────
  { 理由: "トイレ（急ぎ）", 緊急度: 4, 要約: "強い排泄の訴え。間に合わない可能性あり", 特記事項: "視線入力からの自動送信", 送信者: "きよ子" },
  { 理由: "めまいがする",   緊急度: 4, 要約: "めまいの訴え。転倒リスクあり",          特記事項: "",                      送信者: "きよ子" },
  { 理由: "気分が悪い",     緊急度: 4, 要約: "嘔気・気分不良の訴え。要バイタル確認",  特記事項: "",                      送信者: "アライキヨコ" },
  { 理由: "助けて",         緊急度: 4, 要約: "強い不安・助けを呼ぶ訴え",              特記事項: "",                      送信者: "ムラセタロウ" },

  // ── 緊急度 5：最優先（転倒・激痛） ────────────────────────────────────
  { 理由: "胸が痛い",       緊急度: 5, 要約: "【至急】胸痛の訴え。心疾患の可能性",   特記事項: "",                      送信者: "きよ子" },
  { 理由: "転んだ",         緊急度: 5, 要約: "【至急】転倒の訴え。骨折リスクあり",   特記事項: "",                      送信者: "アライキヨコ" },
  { 理由: "頭が痛い（激しく）", 緊急度: 5, 要約: "【至急】激しい頭痛の訴え。要即時確認", 特記事項: "",                  送信者: "きよ子" },
];

// 重み付きランダム選択（緊急度別の出現頻度を制御）
const WEIGHT_MAP: Record<number, number> = { 1: 15, 2: 28, 3: 35, 4: 15, 5: 7 };

function pickTemplate(): Template {
  const pool: Template[] = [];
  TEMPLATES.forEach((t) => {
    const w = WEIGHT_MAP[t.緊急度] ?? 10;
    for (let i = 0; i < w; i++) pool.push(t);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

// 過去7日間に分散した Timestamp を生成（時間帯に重み付け）
function randomTimestamp(daysAgo: number): Timestamp {
  const base = new Date();
  base.setDate(base.getDate() - daysAgo);

  // 時間帯の重み（夜間より昼間に集中）
  const hourWeights = [
    1,1,1,1,2,3, // 0-5時
    5,8,9,9,8,9, // 6-11時
    9,8,8,9,9,8, // 12-17時
    8,7,6,4,3,2, // 18-23時
  ];
  const total = hourWeights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  let hour = 0;
  for (let i = 0; i < 24; i++) {
    rand -= hourWeights[i];
    if (rand <= 0) { hour = i; break; }
  }

  base.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return Timestamp.fromDate(base);
}

// ─── メインコンポーネント ─────────────────────────────────────────────────

type Status = "idle" | "seeding" | "done" | "deleting" | "error";

export default function SeedDataButton() {
  const [status,   setStatus]   = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message,  setMessage]  = useState("");
  const [open,     setOpen]     = useState(false);

  // 1週間分 105 件生成
  const seed = async () => {
    setStatus("seeding");
    setProgress(0);
    setMessage("シードデータを生成中...");

    try {
      // 1日あたりの件数分布
      const dailyCounts = [12, 14, 13, 16, 15, 18, 17]; // 合計 105
      let batchDocs: { ts: Timestamp; tpl: Template }[] = [];

      dailyCounts.forEach((count, dayIdx) => {
        const daysAgo = 6 - dayIdx; // 6日前→今日
        for (let i = 0; i < count; i++) {
          batchDocs.push({ ts: randomTimestamp(daysAgo), tpl: pickTemplate() });
        }
      });

      // 500件上限対策で50件ずつのバッチ処理
      const CHUNK = 50;
      for (let i = 0; i < batchDocs.length; i += CHUNK) {
        const chunk = batchDocs.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(({ ts, tpl }) => {
          const ref = doc(collection(db, "calls"));
          batch.set(ref, {
            理由:     tpl.理由,
            要約:     tpl.要約,
            緊急度:   tpl.緊急度,
            特記事項: tpl.特記事項,
            送信者:   tpl.送信者,
            送信日時: ts,
          });
        });
        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / batchDocs.length) * 100));
      }

      setStatus("done");
      setMessage(`✅ ${batchDocs.length} 件のデモデータを追加しました`);
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e: any) {
      setStatus("error");
      setMessage(`❌ エラー: ${e?.message ?? e}`);
    }
  };

  // 全コール削除
  const deleteAll = async () => {
    if (!confirm("⚠️ Firestoreの全コールデータを削除します。よろしいですか？")) return;
    setStatus("deleting");
    setMessage("削除中...");
    try {
      const snap = await getDocs(query(collection(db, "calls"), orderBy("送信日時", "desc")));
      const CHUNK = 50;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        setProgress(Math.round(((i + CHUNK) / snap.docs.length) * 100));
      }
      setStatus("done");
      setMessage(`🗑️ ${snap.docs.length} 件を削除しました`);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: any) {
      setStatus("error");
      setMessage(`❌ エラー: ${e?.message ?? e}`);
    }
  };

  const busy = status === "seeding" || status === "deleting";

  return (
    <div className="relative">
      {/* トグルボタン */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-1.5 text-[10px] font-black text-stone-400 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-500"
      >
        <DatabaseZap className="h-3 w-3" />
        DEV
      </button>

      {/* パネル */}
      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-violet-700">
            <DatabaseZap className="h-3.5 w-3.5" />
            デモデータ管理（開発者専用）
          </p>

          {/* プログレス */}
          {busy && (
            <div className="mb-3">
              <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-500">{progress}%</p>
            </div>
          )}

          {/* メッセージ */}
          {message && (
            <p className="mb-3 rounded-xl bg-stone-50 px-3 py-2 text-[10px] text-stone-600">{message}</p>
          )}

          <div className="flex flex-col gap-2">
            {/* シード */}
            <button
              onClick={seed}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-violet-600 active:scale-95 disabled:opacity-50"
            >
              {status === "seeding"
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中...</>
                : status === "done"
                  ? <><CheckCircle2 className="h-3.5 w-3.5" /> 完了！</>
                  : <><DatabaseZap className="h-3.5 w-3.5" /> 過去7日分を生成（105件）</>}
            </button>

            {/* 削除 */}
            <button
              onClick={deleteAll}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
            >
              {status === "deleting"
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 削除中...</>
                : <><Trash2 className="h-3.5 w-3.5" /> 全データを削除</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
