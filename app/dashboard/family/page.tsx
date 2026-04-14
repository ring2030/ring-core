"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Clock, Heart, MessageCircle, RefreshCw, Sparkles, WifiOff, Video } from "lucide-react";
import type { CallSummaryItem } from "@/app/api/family-summary/route";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import {
  DashboardHeader,
  DashboardNavStrip,
  DashboardPageFrame,
} from "@/components/dashboard/DashboardChrome";
import { AppButton, AppCard, StatusBadge } from "@/components/ui/ThemePrimitives";

// ─── 型 ──────────────────────────────────────────────

interface CallDoc {
  id: string;
  reasons: string[];
  notes: string;
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

function todayLabel(): string {
  const d = new Date();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${mm}/${dd}（${weekday}）`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
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

function TimelineDot({ reasons }: { reasons: string[] }) {
  const isToilet = reasons.includes("トイレ");
  const isChat = reasons.includes("お話");
  if (isToilet)
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-base">
        🚽
      </span>
    );
  if (isChat)
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-200 text-base">
        💬
      </span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-base">
      📋
    </span>
  );
}

// ─── メインページ ──────────────────────────────────────

export default function FamilyDashboardPage() {
  const [calls, setCalls] = useState<CallDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAutoRunRef = useRef(false);

  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [videoUploadOk, setVideoUploadOk] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const dateLabel = todayLabel();

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

  // ─── Firestore 購読（今日分をクライアントで抽出） ──────────────────────

  useEffect(() => {
    let db;
    try {
      db = getFirestoreDb();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Firestore 初期化に失敗しました";
      setFirestoreError(msg);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "calls"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const start = startOfToday().getTime();
          const end = endOfToday().getTime();
          const docs: CallDoc[] = snap.docs
            .map((d) => normalizeCallDoc(d.id, d.data()))
            .filter((item) => {
              const t = item.createdAt.getTime();
              return t >= start && t <= end;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((item) => ({
              id: item.id,
              reasons: item.reasons,
              notes: item.note,
              sender: item.senderName,
              ts: item.createdAt,
            }));
          setCalls(docs);
        } catch (e) {
          console.error("[family] calls map error", e);
          setFirestoreError("データの表示に失敗しました");
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

  // ─── AI 要約生成 ────────────────────────────────────

  const generateSummary = useCallback(async (currentCalls: CallDoc[]) => {
    setAiLoading(true);
    setAiError(null);

    const payload: { date: string; calls: CallSummaryItem[] } = {
      date: dateLabel,
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
      let data: { error?: string; text?: string } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        throw new Error(
          res.ok ? "応答の形式が不正です" : `HTTP ${res.status}`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAiMessage(typeof data.text === "string" ? data.text : null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "要約の取得に失敗しました";
      setAiError(msg);
      console.error("[family] family-summary", e);
    } finally {
      setAiLoading(false);
    }
  }, [dateLabel]);

  // データ取得完了後に1回だけ自動生成（AI 失敗してもページ全体は継続）
  useEffect(() => {
    if (loading || aiAutoRunRef.current) return;
    aiAutoRunRef.current = true;
    void (async () => {
      try {
        await generateSummary(calls);
      } catch (e) {
        console.error("[family] generateSummary", e);
        setAiError(
          e instanceof Error ? e.message : "要約の取得に失敗しました",
        );
      }
    })();
  }, [loading, calls, generateSummary]);

  // ─── 集計 ───────────────────────────────────────────

  const countByReason = calls.reduce<Record<string, number>>((acc, c) => {
    for (const r of c.reasons) acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  const toiletCount = countByReason["トイレ"] ?? 0;
  const chatCount = countByReason["お話"] ?? 0;

  // ─── レンダー ────────────────────────────────────────

  return (
    <DashboardPageFrame>
      {/* ヘッダー */}
      <DashboardHeader
        title="ケアダッシュボード（家族）"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} />
            {dateLabel}のようす
          </span>
        }
        leftIcon={<span className="text-4xl">💗</span>}
        rightSlot={
          <div className="flex items-center gap-3">
            <Heart size={28} className="text-cyan-500" fill="currentColor" />
            <AppButton type="button" tone="secondary" onClick={logout} className="rounded-full text-xs">
              ログアウト
            </AppButton>
          </div>
        }
        contentClassName="max-w-5xl"
      />

      <DashboardNavStrip>
        <div className="mx-auto max-w-5xl">
          <StaffLinks className="text-xs" />
        </div>
      </DashboardNavStrip>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">

        {/* 動画レター（Firebase Storage + messages） */}
        <AppCard className="border-violet-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-violet-700">
            <Video size={18} className="text-violet-500" />
            動画レター（おばあちゃんの画面に届きます）
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            動画を選ぶと Storage の <code className="rounded bg-stone-100 px-1">videos/</code>{" "}
            に保存され、Firestore のメッセージとして送信されます。
          </p>
          {/* iOS / スマホ: display:none + input.click() はファイル選択が開かないことがあるため、label + sr-only を使用 */}
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
                アップロード中…
              </>
            ) : (
              <>
                <Video size={20} className="shrink-0" />
                動画を選んで送信
              </>
            )}
          </label>
          {videoUploadOk && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              送信しました。おばあちゃんの画面で自動再生されます。
            </p>
          )}
          {videoUploadError && (
            <p className="mt-3 text-sm text-red-500">⚠️ {videoUploadError}</p>
          )}
        </AppCard>

        {/* Firestore エラー */}
        {firestoreError && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-600">
            <WifiOff size={20} className="shrink-0" />
            <p className="text-sm font-medium">{firestoreError}</p>
          </div>
        )}

        {/* ─── AI 孫娘メッセージ ─── */}
        <AppCard className="border-rose-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-rose-600">
              <Sparkles size={18} className="text-rose-400" />
              AI 孫娘からのメッセージ
            </h2>
            <AppButton
              type="button"
              tone="secondary"
              disabled={aiLoading || loading}
              onClick={() => generateSummary(calls)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-rose-600"
            >
              <RefreshCw size={12} className={aiLoading ? "animate-spin" : ""} />
              更新
            </AppButton>
          </div>

          {/* メッセージ本文 */}
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
              <p className="text-sm text-red-400">
                ⚠️ {aiError}
              </p>
            ) : aiMessage ? (
              <p className="text-[1.05rem] leading-relaxed text-stone-700">
                {aiMessage}
              </p>
            ) : (
              <p className="text-sm text-stone-400">メッセージを生成できませんでした。</p>
            )}
          </div>
        </AppCard>

        {/* ─── 今日の統計 ─── */}
        <AppCard className="border-amber-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-700">
            <MessageCircle size={18} className="text-amber-500" />
            今日の呼び出しまとめ
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
                label="合計"
                value={calls.length}
                color="bg-amber-100 text-amber-800"
              />
              <StatPill
                label="🚽 トイレ"
                value={toiletCount}
                color="bg-orange-100 text-orange-700"
              />
              <StatPill
                label="💬 お話"
                value={chatCount}
                color="bg-rose-100 text-rose-700"
              />
            </div>
          )}
        </AppCard>

        {/* ─── 今日のタイムライン ─── */}
        <AppCard className="border-stone-200/60 bg-white/80 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-stone-600">
            <Clock size={18} className="text-stone-400" />
            今日の呼び出し履歴
            <StatusBadge tone="neutral" className="ml-auto text-xs font-medium">
              {calls.length} 件
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
              <p className="text-sm">今日はまだ呼び出しがありません</p>
              <p className="text-xs">おばあちゃんは穏やかに過ごしています</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {[...calls].reverse().map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3"
                >
                  <TimelineDot reasons={c.reasons} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-stone-700">
                      {c.reasons.join("・") || "不明"}
                    </p>
                    {c.notes && (
                      <p className="mt-0.5 text-xs text-stone-400">{c.notes}</p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-stone-400">
                    <Clock size={11} />
                    {toHHMM(c.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>

        {/* フッター */}
        <p className="text-center text-xs text-stone-400">
          今日のデータをリアルタイムで確認中 —{" "}
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-400 align-middle" />{" "}
          接続中
        </p>
      </main>
    </DashboardPageFrame>
  );
}
