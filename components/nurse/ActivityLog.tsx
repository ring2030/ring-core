"use client";

import { Bell } from "lucide-react";
import { StatusBadge } from "@/components/ui/ThemePrimitives";
import { getPriorityBadge } from "@/lib/dashboard/priorityBadge";

// ─── 型 ──────────────────────────────────────────────────────────────────────

export interface CallRow {
  id: string;
  reason: string;
  summary: string;
  priority: number;
  sender: string;
  date: Date;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const REASON_EMOJI: Record<string, string> = {
  "トイレ": "🚽", "お話": "💬", "痛い": "🚨", "寂しい": "🤝",
  "水が欲しい": "💧", "薬が欲しい": "💊", "胸が痛い": "🚨",
  "転んだ": "⚠️", "眠れない": "🌙", "不安": "🫂", "助けて": "🚨",
};

// ─── コンポーネント ───────────────────────────────────────────────────────────

export default function ActivityLog({ calls }: { calls: CallRow[] }) {
  return (
    <div className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400">
          <Bell className="h-3.5 w-3.5 animate-pulse text-emerald-400" /> アクティビティログ
        </h2>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          <span className="text-[10px] font-black text-stone-400">LIVE</span>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-stone-100">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-stone-50">
            <tr>
              {["時刻", "患者", "内容", "緊急度", "AI要約"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-stone-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {calls.slice(0, 20).map((c) => {
              const badge = getPriorityBadge(c.priority);
              return (
                <tr
                  key={c.id}
                  className={`transition-colors ${
                    c.priority >= 4 ? "bg-red-50 hover:bg-red-100" : "hover:bg-stone-50"
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-stone-400">
                    {c.date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 font-bold text-stone-700">{c.sender}さん</td>
                  <td className="px-4 py-3 font-bold text-stone-700">
                    {REASON_EMOJI[c.reason] ?? "📋"} {c.reason}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-stone-400">
                    {c.summary || "—"}
                  </td>
                </tr>
              );
            })}
            {calls.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center font-bold text-stone-300">
                  記録なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
