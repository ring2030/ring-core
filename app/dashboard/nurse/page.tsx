"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  BarChart, Bar, CartesianGrid, Cell, Legend, PieChart, Pie,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, BedDouble, Bell,
  CheckCircle2, Clock, Heart, Sparkles,
  TrendingDown, UserCheck, Volume2, Wifi, WifiOff, X,
} from "lucide-react";

import PatientCard, { type PatientCardData } from "@/components/nurse/PatientCard";
import ActivityLog,  { type CallRow }        from "@/components/nurse/ActivityLog";
import SeedDataButton from "@/components/nurse/SeedDataButton";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import {
  DashboardHeader,
  DashboardNavStrip,
  DashboardPageFrame,
} from "@/components/dashboard/DashboardChrome";
import { AppButton, AppCard, StatusBadge } from "@/components/ui/ThemePrimitives";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import { normalizeCallDoc } from "@/lib/calls/schema";

// ─── 患者マスタ ───────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  room: string;
  age: number;
  condition: string;
  senderNames: string[];
}

const PATIENTS: Patient[] = [
  { id: "kiyoko", name: "アライキヨコ",  room: "101", age: 82, condition: "アルツハイマー型認知症", senderNames: ["きよ子","アライキヨコ"] },
  { id: "tome",   name: "ムラセタロウ",  room: "102", age: 78, condition: "レビー小体型認知症",    senderNames: ["ムラセタロウ","トメ","とめ"] },
  { id: "hanako", name: "ミヤキタジロウ", room: "103", age: 85, condition: "血管性認知症",          senderNames: ["ミヤキタジロウ","花子","はなこ"] },
];

// ─── 分析モックデータ ─────────────────────────────────────────────────────────

const DETAIL_REASON_DATA = [
  { name: "排泄の介助",         value: 28, color: "#f97316", emoji: "🚽" },
  { name: "傾聴・お話し相手",   value: 22, color: "#60a5fa", emoji: "💬" },
  { name: "不安・孤独感の緩和", value: 18, color: "#a78bfa", emoji: "🤝" },
  { name: "水分・食事サポート", value: 12, color: "#34d399", emoji: "💧" },
  { name: "痛み・体調管理",     value:  8, color: "#f87171", emoji: "🚨" },
  { name: "その他",             value:  6, color: "#94a3b8", emoji: "📋" },
];

const MONTHLY_COMPARISON = [
  { month: "4月", 緊急対応: 45, AIの傾聴で安心:  0 },
  { month: "5月", 緊急対応: 48, AIの傾聴で安心:  0 },
  { month: "6月", 緊急対応: 31, AIの傾聴で安心: 17 },
  { month: "7月", 緊急対応: 19, AIの傾聴で安心: 36 },
  { month: "8月", 緊急対応: 17, AIの傾聴で安心: 38 },
  { month: "9月", 緊急対応: 14, AIの傾聴で安心: 40 },
];

const KPI = { aiResolvedRate: 74, reducedVisits: 31, savedMinutes: 155 } as const;

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function reasonStr(raw: unknown): string {
  if (Array.isArray(raw)) return raw[0] ?? "不明";
  return String(raw ?? "不明");
}

const REASON_EMOJI: Record<string, string> = {
  "トイレ": "🚽", "お話": "💬", "痛い": "🚨", "寂しい": "🤝",
  "水が欲しい": "💧", "薬が欲しい": "💊", "胸が痛い": "🚨", "転んだ": "⚠️",
  "眠れない": "🌙", "不安": "🫂", "助けて": "🚨", "トイレ（急ぎ）": "🚽",
  "気分が悪い": "😔", "めまいがする": "💫", "お腹が空いた": "🍚",
  "寒い": "🥶", "体位を変えて": "🛏️",
};

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

// ─── Toast 型 ─────────────────────────────────────────────────────────────────

interface Toast { id: string; patientName: string; reason: string; priority: number; }

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function NurseDashboard() {
  const [isOnline,       setIsOnline]       = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [calls,          setCalls]          = useState<CallRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [toasts,         setToasts]         = useState<Toast[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [inviteRole, setInviteRole] = useState<"family" | "patient">("family");
  const [invitePatientName, setInvitePatientName] = useState("きよ子");
  const [inviteMinutes, setInviteMinutes] = useState(180);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const initResult = useMemo(() => {
    try {
      return {
        auth: getFirebaseAuth(),
        db: getFirestoreDb(),
        initError: null as string | null,
      };
    } catch (e: unknown) {
      return {
        auth: null,
        db: null,
        initError: e instanceof Error ? e.message : "Firebase 初期化に失敗しました。",
      };
    }
  }, []);

  const isInitialLoad     = useRef(true);
  const isAudioEnabledRef = useRef(false);
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  // ── チャイム ──────────────────────────────────────────────────────────────
  const playChime = useCallback((urgent: boolean) => {
    if (!isAudioEnabledRef.current) return;
    try {
      const aw = window as AudioWindow;
      const Ctx = globalThis.AudioContext || aw.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (urgent) {
        [0, 0.32, 0.64].forEach((offset) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
          gain.gain.setValueAtTime(0.07, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.28);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.3);
        });
      } else {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      }
    } catch {}
  }, []);

  // ── 認証 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initResult.auth) return;
    signInAnonymously(initResult.auth).catch(console.error);
    return onAuthStateChanged(initResult.auth, () => {});
  }, [initResult]);

  // ── Firestore ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initResult.db) return;

    const q = query(collection(initResult.db, "calls"), orderBy("送信日時", "desc"));
    return onSnapshot(q, (snap) => {
      setIsOnline(true);

      if (!isInitialLoad.current) {
        snap.docChanges().filter((c) => c.type === "added").forEach((c) => {
          const data     = c.doc.data();
          const priority = data.緊急度 ?? 1;
          const reason   = reasonStr(data.理由);
          const sender   = data.送信者 ?? "患者";

          playChime(priority >= 4);

          if (priority >= 3) {
            const toast: Toast = { id: c.doc.id, patientName: sender, reason, priority };
            setToasts((prev) => [toast, ...prev.slice(0, 2)]);
            if (priority >= 4) setAlertDismissed(false);
            setTimeout(() => setToasts((p) => p.filter((t) => t.id !== toast.id)), 6_000);
          }
        });
      }

      isInitialLoad.current = false;
      setCalls(
        snap.docs.map((d) => {
          const normalized = normalizeCallDoc(d.id, d.data());
          return {
            id: normalized.id,
            reason: reasonStr(normalized.reasons),
            notes: normalized.note,
            summary: normalized.aiSummary,
            priority: normalized.priority,
            sender: normalized.senderName,
            date: normalized.createdAt,
          };
        }),
      );
      setLoading(false);
    }, () => setIsOnline(false));
  }, [playChime, initResult]);

  const issueInvite = useCallback(async () => {
    setInviteLoading(true);
    setInviteError(null);
    setInviteLink(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
          patientName: invitePatientName.trim() || "きよ子",
          expiresInMinutes: inviteMinutes,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; path?: string };
      if (!res.ok || !data.ok || !data.path) {
        throw new Error(data.error ?? "招待URLを発行できませんでした。");
      }
      setInviteLink(`${window.location.origin}${data.path}`);
    } catch (error: unknown) {
      setInviteError(error instanceof Error ? error.message : "招待URLを発行できませんでした。");
    } finally {
      setInviteLoading(false);
    }
  }, [inviteMinutes, invitePatientName, inviteRole]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  // ── 患者データ集計 ────────────────────────────────────────────────────────
  const patientData = useMemo((): PatientCardData[] => {
    return PATIENTS.map((p) => {
      const myCalls    = calls.filter((c) => p.senderNames.includes(c.sender));
      const todayCalls = myCalls.filter((c) => isToday(c.date));
      const latest     = todayCalls[0] ?? null;
      const maxPriority = todayCalls.length > 0 ? Math.max(...todayCalls.map((c) => c.priority)) : 0;
      return { ...p, myCalls, todayCalls, latest, maxPriority };
    }).sort((a, b) => b.maxPriority - a.maxPriority);
  }, [calls]);

  const hasEmergency = patientData.some((p) => p.maxPriority >= 4);

  // ── チャート集計 ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const counts: Record<string, number> = { "トイレ": 0, "お話": 0, "痛い": 0, "寂しい": 0, "その他": 0 };
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}`, count: 0 }));
    calls.forEach((c) => {
      const key = counts[c.reason] !== undefined ? c.reason : "その他";
      counts[key]++;
      hourly[c.date.getHours()].count++;
    });
    return {
      pieData: Object.entries(counts).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value })),
      hourly,
      total: calls.length,
    };
  }, [calls]);

  // ─── ローディング ─────────────────────────────────────────────────────────
  if (initResult.initError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h1 className="text-xl font-black text-stone-800">ナースステーションを開けませんでした</h1>
        <p className="max-w-xl text-sm text-stone-600">{initResult.initError}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
        <p className="font-bold text-stone-400">ナースステーションを起動中...</p>
      </div>
    );
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .fade-in-down { animation: fadeInDown 0.4s ease-out forwards; }
        .fade-in-up   { animation: fadeInUp   0.4s ease-out forwards; }
      `}</style>

      <DashboardPageFrame>

        {/* ── Toast ──────────────────────────────────────────────────────────── */}
        <div className="fixed right-4 top-4 z-[9999] flex flex-col gap-2 min-w-[260px] max-w-xs">
          {toasts.map((t) => (
            <div key={t.id} className={`flex items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-sm fade-in-down
              ${t.priority >= 4 ? "border-red-200 bg-red-50 text-red-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
              {t.priority >= 4
                ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                : <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
              <div className="flex-1">
                <p className="text-sm font-black">{t.patientName}さんから呼び出し</p>
                <p className="text-xs opacity-75">{REASON_EMOJI[t.reason] ?? "📋"} {t.reason}</p>
              </div>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="opacity-40 hover:opacity-80 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* ── 緊急アラートバー ──────────────────────────────────────────────── */}
        {hasEmergency && !alertDismissed && (
          <div className="flex items-center justify-between bg-red-600 px-6 py-3 text-white shadow-lg fade-in-down">
            <div className="flex animate-pulse items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-black tracking-wide">緊急コールが入っています ─ 至急対応してください</p>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="rounded-full p-1 hover:bg-red-500 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ── 音声バナー ──────────────────────────────────────────────────────── */}
        {!isAudioEnabled && (
          <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-6 py-2.5">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-600">
              <Volume2 className="h-4 w-4 animate-bounce" />
              呼び出し音を有効にしてください
            </p>
            <button
              onClick={() => { setIsAudioEnabled(true); playChime(false); }}
              className="rounded-full bg-rose-500 px-5 py-1.5 text-xs font-black text-white shadow-md hover:bg-rose-600 active:scale-95 transition-all"
            >
              音声を有効化
            </button>
          </div>
        )}

        {/* ── ヘッダー ─────────────────────────────────────────────────────────── */}
        <DashboardHeader
          title="ケアダッシュボード（看護師）"
          subtitle={
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${isOnline ? "text-emerald-500" : "text-stone-400"}`}>
              {isOnline ? <><Wifi className="h-3 w-3" /> リアルタイム接続中</> : <><WifiOff className="h-3 w-3" /> オフライン</>}
            </span>
          }
          leftIcon={
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 shadow-sm">
              <Heart className="h-5 w-5 text-cyan-600" />
            </div>
          }
          rightSlot={
            <div className="flex items-center gap-3">
              <SeedDataButton />
              <div className="hidden text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">担当</p>
                <p className="flex items-center gap-1.5 font-black text-stone-700">
                  <UserCheck className="h-4 w-4 text-cyan-500" />
                  山田 看護師（リーダー）
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-200 bg-cyan-100 text-sm font-black text-cyan-700 transition-transform hover:scale-110">
                山
              </div>
            </div>
          }
          contentClassName="max-w-7xl py-4"
        />

        <DashboardNavStrip className="sm:px-6">
          <div className="mx-auto max-w-7xl">
            <StaffLinks className="text-xs" />
          </div>
        </DashboardNavStrip>

        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          <AppCard tone="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-cyan-700">
                  家族/患者 招待URL発行
                </h2>
                <p className="mt-1 text-xs text-cyan-900/80">
                  都度発行URLで家族画面・患者画面を開けます。
                </p>
              </div>
              <AppButton type="button" tone="secondary" onClick={logout} className="rounded-full text-xs">
                ログアウト
              </AppButton>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "family" | "patient")}
                className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm"
              >
                <option value="family">家族向け</option>
                <option value="patient">患者向け</option>
              </select>
              <input
                value={invitePatientName}
                onChange={(e) => setInvitePatientName(e.target.value)}
                className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm"
                placeholder="患者名"
              />
              <input
                type="number"
                min={10}
                max={1440}
                value={inviteMinutes}
                onChange={(e) => setInviteMinutes(Number(e.target.value))}
                className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm"
              />
              <AppButton type="button" onClick={() => void issueInvite()} disabled={inviteLoading}>
                {inviteLoading ? "発行中..." : "URL発行"}
              </AppButton>
            </div>
            {inviteLink && (
              <div className="mt-3 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-cyan-900">
                <p className="font-bold">発行URL</p>
                <p className="mt-1 break-all">{inviteLink}</p>
              </div>
            )}
            {inviteError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {inviteError}
              </p>
            )}
          </AppCard>

          {/* ── サマリーカード ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "本日のコール", value: calls.filter((c) => isToday(c.date)).length,                     icon: <Bell className="h-5 w-5 text-rose-400" />,     bg: "bg-rose-50 border-rose-100" },
              { label: "担当患者",     value: PATIENTS.length,                                                  icon: <BedDouble className="h-5 w-5 text-sky-400" />,  bg: "bg-sky-50 border-sky-100" },
              { label: "緊急対応中",   value: patientData.filter((p) => p.maxPriority >= 4).length,             icon: <AlertTriangle className="h-5 w-5 text-red-400" />, bg: patientData.some((p) => p.maxPriority >= 4) ? "bg-red-50 border-red-200" : "bg-stone-50 border-stone-100" },
              { label: "対応済み",     value: calls.filter((c) => isToday(c.date) && c.priority <= 2).length,   icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />, bg: "bg-emerald-50 border-emerald-100" },
            ].map((s, i) => (
              <div key={s.label} className={`flex items-center gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 fade-in-up ${s.bg}`}
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className="rounded-xl bg-white p-2 shadow-sm">{s.icon}</div>
                <div>
                  <p className="text-xs font-bold text-stone-400">{s.label}</p>
                  <p className="text-2xl font-black text-stone-800">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── 患者カード一覧 ────────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400">
              <BedDouble className="h-4 w-4" /> 患者一覧
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patientData.map((p, i) => (
                <div key={p.id} className="fade-in-up" style={{ animationDelay: `${i * 80 + 100}ms` }}>
                  <PatientCard patient={p} />
                </div>
              ))}
            </div>
          </section>

          {/* ── AI 効果分析ダッシュボード ──────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400">
                <Sparkles className="h-4 w-4 text-violet-400" /> AI 効果分析ダッシュボード
              </h2>
              <StatusBadge tone="accent" className="px-3 py-1">
                実証データ（4〜9月累計）
              </StatusBadge>
            </div>

            <div className="grid gap-6 md:grid-cols-2">

              {/* 左：詳細ドーナツ */}
              <div className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                <h3 className="mb-1 flex items-center gap-2 font-black text-stone-700">
                  <Activity className="h-4 w-4 text-rose-400" />
                  呼び出し理由の詳細分析
                </h3>
                <p className="mb-5 text-[11px] text-stone-400">AIサマリーをもとに6カテゴリに分類（累計 94 件）</p>

                {/* ResponsiveContainerはminHeight付きdivでラップ（Recharts警告対策） */}
                <div style={{ width: "100%", minHeight: 192 }}>
                  <ResponsiveContainer width="99%" height={192}>
                    <PieChart>
                      <Pie data={DETAIL_REASON_DATA} innerRadius={52} outerRadius={76} paddingAngle={4} dataKey="value" stroke="none">
                        {DETAIL_REASON_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} 件`]} contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 space-y-1.5">
                  {DETAIL_REASON_DATA.map((d) => {
                    const pct = Math.round((d.value / 94) * 100);
                    return (
                      <div key={d.name} className="flex items-center gap-2.5">
                        <span className="text-sm">{d.emoji}</span>
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 text-[11px] font-bold text-stone-600">{d.name}</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="w-8 text-right text-[10px] font-black text-stone-500">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右：KPI + 比較バー */}
              <div className="flex flex-col gap-4 rounded-3xl border border-stone-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                <div>
                  <h3 className="mb-1 flex items-center gap-2 font-black text-stone-700">
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    AI 導入による削減効果
                  </h3>
                  <p className="text-[11px] text-stone-400">優先度 1〜2 はAIの傾聴で安心、3〜5 のみ駆けつけ対応</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: `${KPI.aiResolvedRate}%`,     label: "AIの傾聴で\n安心できたコール", bg: "from-violet-50 to-violet-100 border-violet-100", text: "text-violet-700" },
                    { value: `${KPI.reducedVisits}件`,      label: "削減された\n月間駆けつけ",     bg: "from-emerald-50 to-emerald-100 border-emerald-100", text: "text-emerald-700" },
                    { value: `${KPI.savedMinutes}分`,       label: "看護師の\n節約時間/月",        bg: "from-sky-50 to-sky-100 border-sky-100", text: "text-sky-700" },
                  ].map((k) => (
                    <div key={k.label} className={`rounded-2xl bg-gradient-to-br border p-3 text-center ${k.bg}`}>
                      <p className={`text-xl font-black ${k.text}`}>{k.value}</p>
                      <p className="mt-0.5 whitespace-pre-line text-[9px] font-bold leading-tight text-stone-500">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex-1">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-stone-400">月別コール対応内訳</p>
                  <div style={{ width: "100%", minHeight: 176 }}>
                    <ResponsiveContainer width="99%" height={176}>
                      <BarChart data={MONTHLY_COMPARISON} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#a8a29e", fontSize: 10, fontWeight: "bold" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#a8a29e", fontSize: 10 }} width={24} />
                        <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "12px", fontSize: "11px" }} formatter={(v) => [`${v} 件`]} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", fontWeight: "bold", paddingTop: "4px" }} />
                        <Bar dataKey="緊急対応"       fill="#fda4af" radius={[4,4,0,0]} maxBarSize={20} />
                        <Bar dataKey="AIの傾聴で安心" fill="#7dd3fc" radius={[4,4,0,0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-bold leading-relaxed text-emerald-700">
                    💡 月平均 <strong>{KPI.reducedVisits} 件</strong>の駆けつけを削減。
                    看護師の余力を、本当に必要な患者ケアへ集中できます。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 時間帯別アクティビティ ────────────────────────────────────────── */}
          <div className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400">
              <Clock className="h-3.5 w-3.5 text-sky-400" /> 時間帯別アクティビティ
            </h2>
            <div style={{ width: "100%", minHeight: 208 }}>
              <ResponsiveContainer width="99%" height={208}>
                <BarChart data={stats.hourly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#a8a29e", fontSize: 10, fontWeight: "bold" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#a8a29e", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "12px" }} />
                  <Bar dataKey="count" fill="#fb7185" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── アクティビティログ ────────────────────────────────────────────── */}
          <ActivityLog calls={calls} />

        </div>
      </DashboardPageFrame>
    </>
  );
}
