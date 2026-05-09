"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { normalizeCallDoc } from "@/lib/calls/schema";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Sparkles,
  Stethoscope,
  Bot,
  Moon,
  Sun,
  Sunset,
} from "lucide-react";
import { buildHighlight, dateLabel } from "@/lib/dashboard/historyUtils";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import {
  DashboardHeader,
  DashboardNavStrip,
  DashboardPageFrame,
} from "@/components/dashboard/DashboardChrome";
import { AppButton, AppCard, StatusBadge } from "@/components/ui/ThemePrimitives";
import { emojiForReason } from "@/lib/calls/reasons";
import { getCallsCollectionNameForCurrentHospital } from "@/lib/auth/clientHospital";

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface CallDoc {
  id: string;
  reason: string;
  summary: string;
  priority: number;
  ts: Date;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

/** Card style by priority band */
const CARD_STYLE = {
  ai:    { bg: "bg-gradient-to-br from-sky-50 to-indigo-50",   border: "border-sky-200",    dot: "bg-sky-400",    label: "AI companion",       icon: <Bot className="h-4 w-4 text-sky-400" /> },
  nurse: { bg: "bg-gradient-to-br from-amber-50 to-orange-50", border: "border-amber-200",  dot: "bg-amber-400",  label: "Staff assisted",   icon: <Stethoscope className="h-4 w-4 text-amber-500" /> },
  urgent:{ bg: "bg-gradient-to-br from-rose-50 to-pink-50",    border: "border-rose-300",   dot: "bg-rose-500",   label: "Urgent staff visit", icon: <Stethoscope className="h-4 w-4 text-rose-500" /> },
};

function cardStyle(priority: number) {
  if (priority >= 4) return CARD_STYLE.urgent;
  if (priority === 3) return CARD_STYLE.nurse;
  return CARD_STYLE.ai;
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function startOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
function isToday(date: Date): boolean {
  return new Date().toDateString() === date.toDateString();
}

// ─── 時間帯アイコン ───────────────────────────────────────────────────────────

function TimeOfDayIcon({ hour }: { hour: number }) {
  if (hour >= 5  && hour < 10) return <Sun className="h-3.5 w-3.5 text-amber-400" />;
  if (hour >= 10 && hour < 17) return <Sun className="h-3.5 w-3.5 text-yellow-500" />;
  if (hour >= 17 && hour < 21) return <Sunset className="h-3.5 w-3.5 text-orange-400" />;
  return <Moon className="h-3.5 w-3.5 text-indigo-400" />;
}

// ─── タイムラインカード ───────────────────────────────────────────────────────

function TimelineCard({ call, index }: { call: CallDoc; index: number }) {
  const style   = cardStyle(call.priority);
  const emoji   = emojiForReason(call.reason);
  const hour    = call.ts.getHours();

  return (
    <div
      className="flex gap-3 opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* タイムラインライン */}
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full shadow-sm ${style.dot}`} />
        <div className="mt-1 w-px flex-1 bg-stone-200" />
      </div>

      {/* カード本体 */}
      <div className={`mb-4 flex-1 overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${style.bg} ${style.border}`}>
        <div className="p-4">
          {/* 時刻 + 対応タイプ */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TimeOfDayIcon hour={hour} />
              <span className="font-mono text-xs font-bold text-stone-500">
                {call.ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <StatusBadge tone="neutral" className="gap-1.5 border-white/60 bg-white/70 shadow-sm backdrop-blur-sm">
              {style.icon}
              <span className="text-stone-600">{style.label}</span>
            </StatusBadge>
          </div>

          {/* 用件 */}
          <p className="mb-1.5 font-bold text-stone-800">
            {emoji} {call.reason}
          </p>

          {/* AI要約 */}
          {call.summary && (
            <div className="flex items-start gap-1.5 rounded-xl bg-white/60 px-3 py-2 backdrop-blur-sm">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              <p className="text-xs leading-relaxed text-stone-600">{call.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function FamilyHistoryPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOf(new Date()));
  const [calls,        setCalls]        = useState<CallDoc[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const dbResult = useMemo(() => {
    try {
      return { db: getFirestoreDb(), initError: null as string | null };
    } catch (e: unknown) {
      return {
        db: null,
        initError: e instanceof Error ? e.message : "Firestore failed to initialize",
      };
    }
  }, []);
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  // Firestore 購読
  useEffect(() => {
    if (!dbResult.db) {
      return;
    }

    const q = query(collection(dbResult.db, getCallsCollectionNameForCurrentHospital()));

    const unsub = onSnapshot(q, (snap) => {
      const start = startOf(selectedDate).getTime();
      const end = endOf(selectedDate).getTime();
      const normalized = snap.docs.map((d) => normalizeCallDoc(d.id, d.data()));
      const docs: CallDoc[] = normalized
        .filter((item) => {
          const t = item.createdAt.getTime();
          return t >= start && t <= end;
        })
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((item) => ({
          id: item.id,
          reason: item.reasons.join(" · "),
          summary: item.aiSummary,
          priority: item.priority,
          ts: item.createdAt,
        }));

      // UX guard: if "today" is empty but data exists on other days,
      // jump to the latest day that has entries so the page is never blank
      // on first open after seeding.
      if (docs.length === 0 && isToday(selectedDate) && normalized.length > 0) {
        const latest = normalized
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (latest) {
          setSelectedDate(startOf(latest.createdAt));
          return;
        }
      }
      setCalls(docs);
      setLoading(false);
    }, (err) => {
      setError(err.message.includes("index")
        ? "Firestore needs an index. Open the link in the console error to create it."
        : err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate, dbResult]);
  const fatalError = dbResult.initError ?? error;

  // 日付ナビ
  const prevDay = () => {
    setLoading(true);
    setCalls([]);
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  };
  const nextDay = () => {
    if (isToday(selectedDate)) return;
    setLoading(true);
    setCalls([]);
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  };

  // 集計
  const stats = useMemo(() => {
    const aiCalls     = calls.filter((c) => c.priority <= 2).length;
    const nurseCalls  = calls.filter((c) => c.priority === 3).length;
    const urgentCalls = calls.filter((c) => c.priority >= 4).length;
    return { total: calls.length, aiCalls, nurseCalls, urgentCalls };
  }, [calls]);

  const highlight = useMemo(
    () => buildHighlight(calls, dateLabel(selectedDate)),
    [calls, selectedDate]
  );

  // ─── エラー ─────────────────────────────────────────────────────────────────
  if (fatalError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rose-50 p-8">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="mb-6 text-sm font-bold text-red-500">{fatalError}</p>
          <AppButton onClick={() => window.location.reload()} tone="danger" className="px-6 py-3">
            Reload
          </AppButton>
        </div>
      </div>
    );
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <DashboardPageFrame>

        {/* ── ヘッダー ───────────────────────────────────────────────────────── */}
        <DashboardHeader
          title="Care history (family)"
          leftIcon={<Heart className="h-5 w-5 animate-pulse text-cyan-500" />}
          rightSlot={<AppButton type="button" tone="secondary" onClick={logout} className="rounded-full text-[11px]">Sign out</AppButton>}
          contentClassName="max-w-lg px-4 py-4"
        />
        <div className="mx-auto max-w-lg px-4 pt-3">
          {/* 日付ナビ */}
          <div className="flex items-center justify-between rounded-2xl bg-cyan-50 px-2 py-1.5">
            <button
              onClick={prevDay}
              className="rounded-xl p-2 transition-all hover:bg-cyan-100 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-cyan-600" />
            </button>
            <div className="text-center">
              <span className="text-sm font-bold text-slate-800">{dateLabel(selectedDate)}</span>
              {isToday(selectedDate) && (
                <StatusBadge tone="info" className="ml-2 border-cyan-500 bg-cyan-500 text-white shadow-sm">
                  Today
                </StatusBadge>
              )}
            </div>
            <button
              onClick={nextDay}
              disabled={isToday(selectedDate)}
              className="rounded-xl p-2 transition-all hover:bg-cyan-100 hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5 text-cyan-600" />
            </button>
          </div>
        </div>

        <DashboardNavStrip className="mt-3">
          <div className="mx-auto max-w-lg">
            <StaffLinks className="text-xs" />
          </div>
        </DashboardNavStrip>

        <main className="mx-auto max-w-lg px-4 py-6">

          {/* ── ローディング ─────────────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
              <p className="font-bold text-rose-400">Loading…</p>
            </div>
          )}

          {/* ── データなし ───────────────────────────────────────────────────── */}
          {!loading && calls.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
              <span className="mb-4 text-7xl">🌸</span>
              <p className="text-lg font-bold text-rose-700">No entries this day</p>
              <p className="mt-2 text-sm text-rose-400">
                Calls and notes for Kiyoko will appear here
              </p>
            </div>
          )}

          {/* ── データあり ───────────────────────────────────────────────────── */}
          {!loading && calls.length > 0 && (
            <>
              {/* ── AIハイライトカード ──────────────────────────────────────── */}
              <AppCard className="mb-6 overflow-hidden border-violet-200 bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-50 p-5 opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-200">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-violet-600 uppercase tracking-wider">Day highlight</p>
                    <p className="text-[10px] text-violet-400">AI summary</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-violet-900 font-medium">{highlight}</p>
              </AppCard>

              {/* ── サマリーカード（3点） ────────────────────────────────────── */}
              <div className="mb-6 grid grid-cols-3 gap-3 opacity-0 animate-[fadeInUp_0.5s_ease-out_0.1s_forwards]">
                <div className="rounded-2xl border border-rose-100 bg-white p-3 text-center shadow-sm transition-transform hover:scale-105">
                  <p className="text-2xl font-black text-rose-700">{stats.total}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-rose-400">Calls</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-3 text-center shadow-sm transition-transform hover:scale-105">
                  <p className="text-2xl font-black text-sky-600">{stats.aiCalls}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-sky-400">AI</p>
                </div>
                <div className={`rounded-2xl border p-3 text-center shadow-sm transition-transform hover:scale-105 ${
                  stats.urgentCalls > 0 ? "border-rose-200 bg-rose-50" : "border-amber-100 bg-white"
                }`}>
                  <p className={`text-2xl font-black ${stats.urgentCalls > 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {stats.nurseCalls + stats.urgentCalls}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-amber-400">Staff</p>
                </div>
              </div>

              {/* ── タイムライン ─────────────────────────────────────────────── */}
              <div className="pl-1">
                {calls.map((call, i) => (
                  <TimelineCard key={call.id} call={call} index={i} />
                ))}

                {/* タイムライン終端 */}
                <div className="flex gap-3 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                  style={{ animationDelay: `${calls.length * 60 + 100}ms` }}>
                  <div className="flex flex-col items-center">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-stone-300 bg-white" />
                  </div>
                  <p className="mb-4 text-xs font-bold text-stone-300">
                    {isToday(selectedDate) ? "That’s all for today" : "End of this day’s log"}
                  </p>
                </div>
              </div>

              {/* ── 安心メッセージ ────────────────────────────────────────────── */}
              <AppCard className="mt-4 border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-5 text-center opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]"
                style={{ animationDelay: `${calls.length * 60 + 200}ms` }}>
                <p className="text-2xl mb-2">🌷</p>
                <p className="text-sm font-bold text-rose-700">
                  Kiyoko is looked after by staff and AI, around the clock.
                </p>
                <p className="mt-1 text-xs text-rose-400">Support when it matters</p>
              </AppCard>
            </>
          )}
        </main>
      </DashboardPageFrame>
    </>
  );
}
