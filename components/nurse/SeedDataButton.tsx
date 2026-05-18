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
import {
  planDemoEntries,
  type Scenario,
  utcRotationDay,
} from "@/lib/demo/demoScenarioPlanner";

type Scene = Scenario;

function buildDoc(ts: Timestamp, scene: Scene, senderName: string) {
  const [reason, transcript, note, summary, priority] = scene;
  const tri = transcript.trim();
  return {
    reasonCodes: [reason],
    note,
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
    特記事項: note,
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

      const now = new Date();
      const planned = planDemoEntries(now, utcRotationDay(now.getTime()));
      const entries = planned.map(({ at, scenario, senderName }) => ({
        ts: Timestamp.fromDate(at),
        scene: scenario,
        senderName,
      }));

      const CHUNK = 450;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const { ts, scene, senderName } of entries.slice(i, i + CHUNK)) {
          batch.set(doc(collection(db, col)), buildDoc(ts, scene, senderName));
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
            デモデータ（5/17–18 中心 / 3名 / 日本語会話）
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
