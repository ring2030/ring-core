"use client";

import { useState } from "react";
import { writeBatch, doc, collection, Timestamp, getDocs } from "firebase/firestore";
import { DatabaseZap, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { getFirestoreDb } from "@/lib/firebase";
import { getCallsCollectionNameForCurrentHospital } from "@/lib/auth/clientHospital";

// --- Demo seed templates (weighted random + realistic spread) ---

interface Template {
  reason: string;
  priority: number;
  summary: string;
  note: string;
  sender: string;
}

const TEMPLATES: Template[] = [
  { reason: "Chat", priority: 1, summary: "Small talk / routine", note: "AI chat start", sender: "Kiyoko" },
  { reason: "Chat", priority: 1, summary: "Memory sharing, calm mood", note: "AI chat start", sender: "Kiyoko" },
  { reason: "Chat", priority: 1, summary: "Chat about music", note: "AI chat start", sender: "Kiyoko" },
  { reason: "Chat", priority: 1, summary: "Grandkids topic, upbeat", note: "AI chat start", sender: "Kiyoko Arai" },

  { reason: "Lonely", priority: 2, summary: "Loneliness — wants listening", note: "AI chat start", sender: "Kiyoko" },
  { reason: "Can't sleep", priority: 2, summary: "Insomnia, night anxiety", note: "AI chat start", sender: "Kiyoko" },
  { reason: "Anxious", priority: 2, summary: "Vague anxiety", note: "AI chat start", sender: "Kiyoko Arai" },
  { reason: "Lonely", priority: 2, summary: "Wants family visit", note: "AI chat start", sender: "Taro Murase" },

  { reason: "Wants water", priority: 3, summary: "Hydration request", note: "", sender: "Kiyoko" },
  { reason: "Wants medication", priority: 3, summary: "PRN med request", note: "", sender: "Kiyoko" },
  { reason: "Restroom", priority: 3, summary: "Toileting help", note: "Gaze send", sender: "Kiyoko" },
  { reason: "Reposition", priority: 3, summary: "Repositioning help", note: "", sender: "Kiyoko Arai" },
  { reason: "Cold", priority: 3, summary: "Wants blanket", note: "", sender: "Taro Murase" },
  { reason: "Hungry", priority: 3, summary: "Hungry after mealtime", note: "", sender: "Kiyoko Arai" },

  { reason: "Urgent restroom", priority: 4, summary: "Urgent toileting", note: "Gaze send", sender: "Kiyoko" },
  { reason: "Dizzy", priority: 4, summary: "Dizziness, fall risk", note: "", sender: "Kiyoko" },
  { reason: "Unwell", priority: 4, summary: "Nausea, needs vitals", note: "", sender: "Kiyoko Arai" },
  { reason: "Help", priority: 4, summary: "Calls for help", note: "", sender: "Taro Murase" },

  { reason: "Chest pain", priority: 5, summary: "URGENT: chest pain", note: "", sender: "Kiyoko" },
  { reason: "Fallen", priority: 5, summary: "URGENT: fall", note: "", sender: "Kiyoko Arai" },
  { reason: "Pain", priority: 5, summary: "URGENT: severe headache", note: "", sender: "Kiyoko" },
];

// Weighted random: tune frequency per priority band
const WEIGHT_MAP: Record<number, number> = { 1: 15, 2: 28, 3: 35, 4: 15, 5: 7 };

function pickTemplate(): Template {
  const pool: Template[] = [];
  TEMPLATES.forEach((t) => {
    const w = WEIGHT_MAP[t.priority] ?? 10;
    for (let i = 0; i < w; i++) pool.push(t);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Random timestamp over the last 7 days, biased toward daytime hours. */
function randomTimestamp(daysAgo: number): Timestamp {
  const base = new Date();
  base.setDate(base.getDate() - daysAgo);

  const hourWeights = [
    1, 1, 1, 1, 2, 3, // 0–5
    5, 8, 9, 9, 8, 9, // 6–11
    9, 8, 8, 9, 9, 8, // 12–17
    8, 7, 6, 4, 3, 2, // 18–23
  ];
  const total = hourWeights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  let hour = 0;
  for (let i = 0; i < 24; i++) {
    rand -= hourWeights[i];
    if (rand <= 0) {
      hour = i;
      break;
    }
  }

  base.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return Timestamp.fromDate(base);
}

function callDocPayload(ts: Timestamp, tpl: Template) {
  const reasons = [tpl.reason];
  return {
    reasonCodes: reasons,
    note: tpl.note,
    senderName: tpl.sender,
    senderRole: "patient" as const,
    createdAt: ts,
    priority: tpl.priority,
    aiSummary: tpl.summary,
    // Legacy fields (same shape as buildCallWritePayload)
    理由: reasons,
    特記事項: tpl.note,
    送信者: tpl.sender,
    送信日時: ts,
    緊急度: tpl.priority,
    要約: tpl.summary,
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
    setMessage("Generating demo data…");

    try {
      const db = getFirestoreDb();
      const callsCollection = getCallsCollectionNameForCurrentHospital();
      const dailyCounts = [12, 14, 13, 16, 15, 18, 17]; // 105 total across 7 days
      const batchDocs: { ts: Timestamp; tpl: Template }[] = [];

      dailyCounts.forEach((count, dayIdx) => {
        const daysAgo = 6 - dayIdx;
        for (let i = 0; i < count; i++) {
          batchDocs.push({ ts: randomTimestamp(daysAgo), tpl: pickTemplate() });
        }
      });

      const CHUNK = 50;
      for (let i = 0; i < batchDocs.length; i += CHUNK) {
        const chunk = batchDocs.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(({ ts, tpl }) => {
          const ref = doc(collection(db, callsCollection));
          batch.set(ref, callDocPayload(ts, tpl));
        });
        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / batchDocs.length) * 100));
      }

      setStatus("done");
      setMessage(`✅ Added ${batchDocs.length} demo records`);
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setMessage(`❌ Error: ${msg}`);
    }
  };

  const deleteAll = async () => {
    if (!confirm("⚠️ Delete ALL call records in Firestore?")) return;
    setStatus("deleting");
    setMessage("Deleting…");
    try {
      const db = getFirestoreDb();
      const callsCollection = getCallsCollectionNameForCurrentHospital();
      const snap = await getDocs(collection(db, callsCollection));
      const CHUNK = 50;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        setProgress(Math.round(((i + CHUNK) / snap.docs.length) * 100));
      }
      setStatus("done");
      setMessage(`🗑️ Deleted ${snap.docs.length} records`);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setMessage(`❌ Error: ${msg}`);
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
        <div className="absolute right-0 top-8 z-50 w-64 rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-violet-700">
            <DatabaseZap className="h-3.5 w-3.5" />
            Demo data (dev only)
          </p>

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

          {message && (
            <p className="mb-3 rounded-xl bg-stone-50 px-3 py-2 text-[10px] text-stone-600">{message}</p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={seed}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-violet-600 active:scale-95 disabled:opacity-50"
            >
              {status === "seeding" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
                </>
              ) : status === "done" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Done
                </>
              ) : (
                <>
                  <DatabaseZap className="h-3.5 w-3.5" /> Seed 7 days (105)
                </>
              )}
            </button>

            <button
              onClick={deleteAll}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
            >
              {status === "deleting" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Delete all calls
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
