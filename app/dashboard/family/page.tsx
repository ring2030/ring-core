"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage, getFirestoreDb } from "@/lib/firebase";
import { normalizeCallDoc } from "@/lib/calls/schema";
import { getVideoMessagesCollection } from "@/lib/videoMessages";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Info,
  MessageCircle,
  Quote,
  RefreshCw,
  Sparkles,
  WifiOff,
  Video,
} from "lucide-react";
import type { CallSummaryItem } from "@/app/api/family-summary/route";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import {
  DashboardHeader,
  DashboardNavStrip,
  DashboardPageFrame,
} from "@/components/dashboard/DashboardChrome";
import { AppButton, AppCard, StatusBadge } from "@/components/ui/ThemePrimitives";
import { REASON_CHAT, REASON_RESTROOM, emojiForReason } from "@/lib/calls/reasons";
import { getCallsCollectionNameForCurrentHospital } from "@/lib/auth/clientHospital";
import { dateLabel } from "@/lib/dashboard/historyUtils";

// ─── 型 ──────────────────────────────────────────────

interface CallDoc {
  id: string;
  reasons: string[];
  notes: string;
  /** AI-generated summary of the AI ↔ patient interaction. */
  aiSummary: string;
  /** Patient's spoken line (STT). */
  transcript: string;
  /** Triage band: 1–2 = AI handled, 3 = staff support, 4–5 = urgent. */
  priority: number;
  sender: string;
  ts: Date | null;
}

// ─── ユーティリティ ────────────────────────────────────

function toHHMM(ts: Date | null): string {
  if (!ts) return "??:??";
  const d = ts;
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

function startOfDay(src: Date): Date {
  const d = new Date(src);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(src: Date): Date {
  const d = new Date(src);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isToday(src: Date): boolean {
  return startOfDay(src).getTime() === startOfDay(new Date()).getTime();
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// ─── 小コンポーネント ──────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-2xl px-6 py-4 ${color}`}>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="mt-0.5 text-sm font-medium opacity-80">{label}</span>
    </div>
  );
}

function TimelineDot({ reasons, priority }: { reasons: string[]; priority: number }) {
  const isToilet = reasons.some((r) => r === REASON_RESTROOM || r === "トイレ");
  const isChat = reasons.some((r) => r === REASON_CHAT || r === "お話");
  const ring =
    priority >= 4
      ? "ring-2 ring-red-300"
      : priority === 3
        ? "ring-2 ring-amber-300"
        : "";
  if (isToilet)
    return (
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-base ${ring}`}
      >
        🚽
      </span>
    );
  if (isChat)
    return (
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-200 text-base ${ring}`}
      >
        💬
      </span>
    );
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-base ${ring}`}
    >
      📋
    </span>
  );
}

function priorityBadge(priority: number) {
  if (priority >= 4) {
    return (
      <StatusBadge tone="danger" className="px-2 py-0.5 text-[10px]">
        Staff visited
      </StatusBadge>
    );
  }
  if (priority === 3) {
    return (
      <StatusBadge tone="warning" className="px-2 py-0.5 text-[10px]">
        Staff supported
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="info" className="px-2 py-0.5 text-[10px]">
      AI listened
    </StatusBadge>
  );
}

// ─── メインページ ──────────────────────────────────────

export default function FamilyDashboardPage() {
  // We hold *all* calls (across days) in memory; the selected day is a view
  // filter. This lets us render a 7-day mini chart without refetching.
  const [allCalls, setAllCalls] = useState<CallDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFallback, setAiFallback] = useState<string | null>(null);
  const aiAutoRunRef = useRef<string | null>(null);

  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [videoUploadOk, setVideoUploadOk] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const selectedDateLabel = dateLabel(selectedDate);

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVideoUploadError(null);
    setVideoUploadOk(false);
    setVideoUploading(true);
    try {
      const storage = getFirebaseStorage();
      const coll = getVideoMessagesCollection();
      const path = `videos/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const storageRef = ref(storage, path);
      console.log("[family][video] upload:start", {
        name: file.name,
        size: file.size,
        type: file.type,
        path,
        collection: coll,
      });
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const docRef = await addDoc(collection(getFirestoreDb(), coll), {
        sender: "family",
        type: "video",
        content: url,
        timestamp: serverTimestamp(),
      });
      console.log("[family][video] upload:success", {
        docId: docRef.id,
        collection: coll,
        path,
        url,
      });
      setVideoUploadOk(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[family][video] upload:error", err);
      setVideoUploadError(msg);
    } finally {
      setVideoUploading(false);
    }
  };

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  // ─── Firestore 購読（全件保持→クライアント側で日付フィルタ） ──────────

  useEffect(() => {
    let db;
    try {
      db = getFirestoreDb();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Firestore failed to initialize";
      setFirestoreError(msg);
      setLoading(false);
      return;
    }

    const q = query(collection(db, getCallsCollectionNameForCurrentHospital()));

    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const docs: CallDoc[] = snap.docs
            .map((d) => {
              const norm = normalizeCallDoc(d.id, d.data());
              const raw = d.data() as Record<string, unknown>;
              const transcript = String(
                raw["transcript"] ?? raw["認識文"] ?? "",
              ).trim();
              return {
                id: norm.id,
                reasons: norm.reasons,
                notes: norm.note,
                aiSummary: norm.aiSummary.trim(),
                transcript,
                priority: norm.priority,
                sender: norm.senderName,
                ts: norm.createdAt,
              } satisfies CallDoc;
            })
            .sort(
              (a, b) =>
                (a.ts?.getTime() ?? 0) - (b.ts?.getTime() ?? 0),
            );
          setAllCalls(docs);
        } catch (e) {
          console.error("[family] calls map error", e);
          setFirestoreError("Could not display data");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setFirestoreError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Today is empty but other days have data → silently jump to the latest day
  // with entries. This is important when the family opens the page after a
  // long quiet stretch (otherwise everything looks blank).
  const didAutoJumpRef = useRef(false);
  useEffect(() => {
    if (loading || didAutoJumpRef.current || allCalls.length === 0) return;
    const todayCount = allCalls.filter(
      (c) => c.ts && isSameDay(c.ts, selectedDate),
    ).length;
    if (todayCount > 0 || !isToday(selectedDate)) {
      didAutoJumpRef.current = true;
      return;
    }
    const latestWithData = [...allCalls]
      .filter((c) => c.ts)
      .sort((a, b) => b.ts!.getTime() - a.ts!.getTime())[0];
    if (latestWithData?.ts) {
      didAutoJumpRef.current = true;
      setSelectedDate(startOfDay(latestWithData.ts));
    }
  }, [allCalls, loading, selectedDate]);

  // 選択日の通話
  const calls = useMemo(() => {
    const start = startOfDay(selectedDate).getTime();
    const end = endOfDay(selectedDate).getTime();
    return allCalls.filter((c) => {
      if (!c.ts) return false;
      const t = c.ts.getTime();
      return t >= start && t <= end;
    });
  }, [allCalls, selectedDate]);

  // ─── AI 要約生成 ────────────────────────────────────

  const generateSummary = useCallback(
    async (currentCalls: CallDoc[]) => {
      setAiLoading(true);
      setAiError(null);
      setAiFallback(null);

      const payload: { date: string; calls: CallSummaryItem[] } = {
        date: selectedDateLabel,
        calls: currentCalls.map((c) => ({
          reasons: c.reasons,
          notes: c.notes,
          sender: c.sender,
          time: toHHMM(c.ts),
        })),
      };

      try {
        const res = await fetch("/api/family-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const rawText = await res.text();
        let data: {
          error?: string;
          text?: string;
          fallback?: boolean;
          warning?: string;
          reason?: string;
        } = {};
        try {
          data = rawText ? (JSON.parse(rawText) as typeof data) : {};
        } catch {
          throw new Error(
            res.ok ? "Invalid response format" : `HTTP ${res.status}`,
          );
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setAiMessage(typeof data.text === "string" ? data.text : null);
        setAiFallback(
          data.fallback ? data.warning ?? data.reason ?? "Showing offline summary." : null,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not load summary";
        setAiError(msg);
        console.error("[family] family-summary", e);
      } finally {
        setAiLoading(false);
      }
    },
    [selectedDateLabel],
  );

  // 選択日が変わるたびに AI 要約をリセット → 自動再生成
  useEffect(() => {
    setAiMessage(null);
    setAiError(null);
    setAiFallback(null);
    aiAutoRunRef.current = null;
  }, [selectedDateLabel]);

  // データ取得完了後に1回だけ自動生成（AI 失敗してもページ全体は継続）
  useEffect(() => {
    const runKey = `${selectedDateLabel}:${calls.length}`;
    if (loading || aiAutoRunRef.current === runKey) return;
    aiAutoRunRef.current = runKey;
    void (async () => {
      try {
        await generateSummary(calls);
      } catch (e) {
        console.error("[family] generateSummary", e);
        setAiError(
          e instanceof Error ? e.message : "Could not load summary",
        );
      }
    })();
  }, [loading, calls, generateSummary, selectedDateLabel]);

  // ─── 集計 ───────────────────────────────────────────

  const countByReason = calls.reduce<Record<string, number>>((acc, c) => {
    for (const r of c.reasons) acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  const toiletCount =
    (countByReason[REASON_RESTROOM] ?? 0) + (countByReason["トイレ"] ?? 0);
  const chatCount =
    (countByReason[REASON_CHAT] ?? 0) + (countByReason["お話"] ?? 0);

  // ─── 直近7日のミニチャート ───────────────────────────

  const last7Days = useMemo(() => {
    const today = startOfDay(new Date());
    const days: Array<{ date: Date; count: number; staff: number; urgent: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const start = d.getTime();
      const end = endOfDay(d).getTime();
      const dayCalls = allCalls.filter(
        (c) => c.ts && c.ts.getTime() >= start && c.ts.getTime() <= end,
      );
      days.push({
        date: d,
        count: dayCalls.length,
        staff: dayCalls.filter((c) => c.priority === 3).length,
        urgent: dayCalls.filter((c) => c.priority >= 4).length,
      });
    }
    return days;
  }, [allCalls]);
  const last7Max = Math.max(1, ...last7Days.map((d) => d.count));

  const dayShortLabel = useCallback((d: Date): string => {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? "";
  }, []);

  // ─── レンダー ────────────────────────────────────────

  return (
    <DashboardPageFrame>
      {/* ヘッダー */}
      <DashboardHeader
        title="Care dashboard (family)"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} />
            {selectedDateLabel} snapshot
          </span>
        }
        leftIcon={<span className="text-4xl">💗</span>}
        rightSlot={
          <div className="flex items-center gap-3">
            <Heart size={28} className="text-cyan-500" fill="currentColor" />
            <AppButton type="button" tone="secondary" onClick={logout} className="rounded-full text-xs">
              Sign out
            </AppButton>
          </div>
        }
        contentClassName="max-w-5xl"
      />

      <DashboardNavStrip>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <StaffLinks className="text-xs" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => {
                const n = new Date(d);
                n.setDate(n.getDate() - 1);
                return startOfDay(n);
              })}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Previous day"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-semibold text-stone-600">{selectedDateLabel}</span>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => {
                const n = new Date(d);
                n.setDate(n.getDate() + 1);
                return startOfDay(n);
              })}
              disabled={isToday(selectedDate)}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next day"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </DashboardNavStrip>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">

        {/* Firestore エラー */}
        {firestoreError && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-600">
            <WifiOff size={20} className="shrink-0" />
            <p className="text-sm font-medium">{firestoreError}</p>
          </div>
        )}

        {/* ─── AI 孫娘メッセージ（最上段） ─── */}
        <AppCard className="border-rose-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-rose-600">
              <Sparkles size={18} className="text-rose-400" />
              Message from the AI companion
            </h2>
            <AppButton
              type="button"
              tone="secondary"
              disabled={aiLoading || loading}
              onClick={() => generateSummary(calls)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-rose-600"
            >
              <RefreshCw size={12} className={aiLoading ? "animate-spin" : ""} />
              Refresh
            </AppButton>
          </div>

          {aiFallback && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{aiFallback}</span>
            </div>
          )}

          <div
            className="min-h-[6rem] rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, #fff1f2 0%, #fdf6ec 100%)",
              border: "1.5px solid #fecdd3",
            }}
          >
            {loading || aiLoading ? (
              <div className="flex flex-col gap-2">
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-rose-200" />
                <div className="h-4 w-3/5 animate-pulse rounded-full bg-rose-200" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-rose-200" />
              </div>
            ) : aiError ? (
              <p className="text-sm text-red-400">⚠️ {aiError}</p>
            ) : aiMessage ? (
              <p className="whitespace-pre-line text-[1.05rem] leading-relaxed text-stone-700">
                {aiMessage}
              </p>
            ) : (
              <p className="text-sm text-stone-400">Could not generate a message.</p>
            )}
          </div>
        </AppCard>

        {/* ─── 直近7日のサマリー ─── */}
        <AppCard className="border-cyan-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-cyan-700">
            <Clock size={18} className="text-cyan-500" />
            Past 7 days
          </h2>
          <div className="flex items-end justify-between gap-2">
            {last7Days.map((d) => {
              const selected = isSameDay(d.date, selectedDate);
              const hasUrgent = d.urgent > 0;
              return (
                <button
                  key={d.date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(d.date))}
                  className={`flex w-12 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-all ${
                    selected
                      ? "bg-rose-100 ring-2 ring-rose-300"
                      : "hover:bg-stone-50"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold ${
                      selected ? "text-rose-600" : "text-stone-400"
                    }`}
                  >
                    {dayShortLabel(d.date)}
                  </span>
                  <div className="flex h-16 w-full items-end justify-center">
                    <div
                      className={`w-3 rounded-t transition-all ${
                        hasUrgent
                          ? "bg-red-400"
                          : d.staff > 0
                            ? "bg-amber-400"
                            : d.count > 0
                              ? "bg-cyan-400"
                              : "bg-stone-200"
                      }`}
                      style={{
                        height: `${(d.count / last7Max) * 100}%`,
                        minHeight: d.count > 0 ? 4 : 2,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[10px] tabular-nums ${
                      selected ? "font-bold text-rose-600" : "text-stone-500"
                    }`}
                  >
                    {d.count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-stone-400">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-400 align-middle" />
            AI listened
            <span className="mx-2 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
            Staff helped
            <span className="mx-2 inline-block h-2 w-2 rounded-full bg-red-400 align-middle" />
            Urgent
          </p>
        </AppCard>

        {/* ─── 選択日の統計 ─── */}
        <AppCard className="border-amber-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-700">
            <MessageCircle size={18} className="text-amber-500" />
            {isToday(selectedDate) ? "Today’s calls" : `Calls on ${selectedDateLabel}`}
          </h2>

          {loading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 flex-1 animate-pulse rounded-2xl bg-amber-100"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-4">
              <StatPill
                label="Total"
                value={calls.length}
                color="bg-amber-100 text-amber-800"
              />
              <StatPill
                label="🚽 Restroom"
                value={toiletCount}
                color="bg-orange-100 text-orange-700"
              />
              <StatPill
                label="💬 Chat"
                value={chatCount}
                color="bg-rose-100 text-rose-700"
              />
            </div>
          )}
        </AppCard>

        {/* ─── 選択日のタイムライン ─── */}
        <AppCard className="border-stone-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-stone-600">
            <Clock size={18} className="text-stone-400" />
            {isToday(selectedDate) ? "Today’s timeline" : "Day timeline"}
            <StatusBadge tone="neutral" className="ml-auto text-xs font-medium">
              {calls.length} calls
            </StatusBadge>
          </h2>

          {loading ? (
            <ul className="space-y-3">
              {[1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="h-12 animate-pulse rounded-xl bg-stone-100"
                />
              ))}
            </ul>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-stone-400">
              <span className="text-5xl">☀️</span>
              <p className="text-sm">No calls on this day</p>
              <p className="text-xs">It looks like a quiet day</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {[...calls].reverse().map((c) => {
                const reasonLabel = c.reasons.join(" · ") || "Unknown";
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3"
                  >
                    <TimelineDot reasons={c.reasons} priority={c.priority} />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-700">
                          {emojiForReason(c.reasons[0] ?? "")} {reasonLabel}
                        </p>
                        {priorityBadge(c.priority)}
                      </div>
                      {c.transcript && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs italic leading-relaxed text-rose-700">
                          <Quote size={11} className="mt-0.5 shrink-0 text-rose-400" />
                          <span>“{c.transcript}”</span>
                        </p>
                      )}
                      {c.aiSummary && (
                        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-stone-600">
                          <Sparkles size={11} className="mt-0.5 shrink-0 text-violet-400" />
                          <span>{c.aiSummary}</span>
                        </p>
                      )}
                      {!c.transcript && !c.aiSummary && c.notes && (
                        <p className="text-xs text-stone-400">{c.notes}</p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-stone-400">
                      <Clock size={11} />
                      {toHHMM(c.ts)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>

        {/* ─── 動画レター（フッター寄り。日々送るのではなく時々のため下に） ─── */}
        <AppCard className="border-violet-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-violet-700">
            <Video size={18} className="text-violet-500" />
            Send a video letter
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            The video plays automatically on her tablet. Short clips
            (a “hi grandma!” wave) work best.
          </p>
          <label
            className={`inline-flex min-h-[48px] min-w-[min(100%,20rem)] cursor-pointer touch-manipulation select-none items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 px-6 py-4 text-base font-semibold text-violet-800 transition hover:bg-violet-100 active:scale-[0.99] ${
              videoUploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={videoUploading}
              onChange={handleVideoFile}
            />
            {videoUploading ? (
              <>
                <RefreshCw size={20} className="animate-spin shrink-0" />
                Uploading…
              </>
            ) : (
              <>
                <Video size={20} className="shrink-0" />
                Choose video to send
              </>
            )}
          </label>
          {videoUploadOk && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              Sent. It will play automatically on her screen.
            </p>
          )}
          {videoUploadError && (
            <p className="mt-3 text-sm text-red-500">⚠️ {videoUploadError}</p>
          )}
        </AppCard>

        {/* フッター */}
        <p className="text-center text-xs text-stone-400">
          Live updates for today —{" "}
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-400 align-middle" />{" "}
          connected
        </p>
      </main>
    </DashboardPageFrame>
  );
}
