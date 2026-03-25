"use client";

import { AlertTriangle, Clock, MessageCircle } from "lucide-react";

// ─── 型 ──────────────────────────────────────────────────────────────────────

export interface PatientCardData {
  id: string;
  name: string;
  room: string;
  age: number;
  condition: string;
  maxPriority: number;
  todayCalls: {
    id: string;
    reason: string;
    summary: string;
    priority: number;
    date: Date;
  }[];
  latest: {
    reason: string;
    summary: string;
    priority: number;
    date: Date;
  } | null;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const P_CFG = {
  5: { bar: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200"    },
  4: { bar: "bg-orange-400", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  3: { bar: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-200"  },
  2: { bar: "bg-sky-300",    badge: "bg-sky-100 text-sky-700 border-sky-200"    },
  1: { bar: "bg-stone-200",  badge: "bg-stone-100 text-stone-500 border-stone-200" },
} as const;

const PRIORITY_LABEL: Record<number, string> = {
  5: "最優先", 4: "急ぎ対応", 3: "通常対応", 2: "経過観察", 1: "記録のみ",
};

const REASON_EMOJI: Record<string, string> = {
  "トイレ": "🚽", "お話": "💬", "痛い": "🚨", "寂しい": "🤝",
  "水": "💧", "お水": "💧", "水が欲しい": "💧",
  "薬": "💊", "薬が欲しい": "💊", "胸が痛い": "🚨",
  "転んだ": "⚠️", "眠れない": "🌙", "不安": "🫂", "助けて": "🚨",
};

function toHHMM(d: Date): string {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

export default function PatientCard({ patient }: { patient: PatientCardData }) {
  const { name, room, age, condition, maxPriority, latest, todayCalls } = patient;
  const isUrgent = maxPriority >= 4;
  const cfg = P_CFG[maxPriority as keyof typeof P_CFG] ?? P_CFG[1];

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300
        ${isUrgent
          ? "animate-pulse border-red-300 shadow-lg shadow-red-100 ring-2 ring-red-400"
          : maxPriority >= 3
            ? "border-amber-200 hover:shadow-md hover:border-amber-300"
            : "border-stone-100 hover:border-rose-200 hover:shadow-md"
        }`}
    >
      {/* 緊急度インジケーターバー */}
      <div className={`h-1.5 w-full transition-all ${
        maxPriority > 0 ? (P_CFG[maxPriority as keyof typeof P_CFG]?.bar ?? "bg-stone-200") : "bg-stone-100"
      }`} />

      <div className="p-5">
        {/* ヘッダー */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-lg bg-stone-100 px-2.5 py-0.5 text-xs font-black text-stone-500">
                {room}号室
              </span>
              {isUrgent && (
                <span className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-600">
                  <AlertTriangle className="h-3 w-3" /> 緊急
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-stone-800 group-hover:text-rose-700 transition-colors">
              {name}さん
            </h3>
            <p className="mt-0.5 text-[11px] text-stone-400">{age}歳 · {condition}</p>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black transition-transform group-hover:scale-110
            ${isUrgent ? "bg-red-100 text-red-700" : "bg-rose-50 text-rose-400"}`}>
            {name.charAt(0)}
          </div>
        </div>

        {/* 最新コール */}
        {latest ? (
          <div className={`rounded-2xl border p-3 transition-colors ${
            isUrgent ? "border-red-200 bg-red-50" : "border-stone-100 bg-stone-50 group-hover:border-rose-100 group-hover:bg-rose-50/30"
          }`}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs font-bold text-stone-400">
                <Clock className="h-3 w-3" />
                {toHHMM(latest.date)}
              </p>
              {maxPriority > 0 && (
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${cfg.badge}`}>
                  {PRIORITY_LABEL[maxPriority] ?? "—"}
                </span>
              )}
            </div>
            <p className="font-bold text-stone-700 text-sm">
              {REASON_EMOJI[latest.reason] ?? "📋"} {latest.reason}
            </p>
            {latest.summary && (
              <p className="mt-1.5 flex items-start gap-1 text-[11px] text-stone-400">
                <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                {latest.summary}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-100 bg-stone-50 p-3 text-center transition-colors group-hover:border-rose-100">
            <p className="text-xs font-bold text-stone-300">本日の呼び出しなし</p>
          </div>
        )}

        {/* 本日件数 */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] font-bold text-stone-400">
            本日 {todayCalls.length} 件
          </p>
          <div className="flex gap-1">
            {[...new Set(todayCalls.map((c) => c.reason))]
              .slice(0, 4)
              .map((r, i) => (
                <span key={i} className="text-base transition-transform hover:scale-125">
                  {REASON_EMOJI[r] ?? "📋"}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
