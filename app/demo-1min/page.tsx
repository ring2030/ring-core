"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TOTAL_MS = 60_000;

type Scene = {
  atMs: number;
  title: string;
  subtitle: string;
  detail: string;
  accent: string;
  where: string;
  inputLabel: string;
  inputExample: string;
  actionLabel: string;
};

const SCENES: Scene[] = [
  {
    atMs: 0,
    title: "1) 看護師ログイン",
    subtitle: "/login で看護師がログイン",
    detail: "看護師はパスコードでログインし、ダッシュボードに入ります。",
    accent: "from-cyan-500 to-blue-500",
    where: "入力場所: /login の「パスコード」欄",
    inputLabel: "ログインID / パスワード",
    inputExample: "例: ID 1 / PW 1",
    actionLabel: "「看護師として入る」を押して認証",
  },
  {
    atMs: 15_000,
    title: "2) 招待URL発行",
    subtitle: "/dashboard/nurse でURLを発行",
    detail: "家族向け/患者向けの招待URLを発行して、そのまま共有します。",
    accent: "from-emerald-500 to-cyan-500",
    where: "入力場所: /dashboard/nurse の「家族/患者 招待URL発行」欄",
    inputLabel: "患者名 / 有効分 / 役割",
    inputExample: "例: きよ子 / 180分 / 家族向け",
    actionLabel: "「URL発行」を押して、生成URLをコピー",
  },
  {
    atMs: 30_000,
    title: "3) 患者が呼び出し",
    subtitle: "/kiyoko または / で利用",
    detail: "患者がトイレ・会話を選択すると、看護師側へリアルタイム反映されます。",
    accent: "from-amber-500 to-orange-500",
    where: "操作場所: 患者画面 /kiyoko",
    inputLabel: "入力は不要",
    inputExample: "「トイレ🚽」または「ねぇねぇ」を選択",
    actionLabel: "2秒見つめると送信",
  },
  {
    atMs: 45_000,
    title: "4) 家族が状況確認",
    subtitle: "/access?token=... から自動入室",
    detail: "家族ダッシュボードで当日の様子と履歴、AIメッセージを確認できます。",
    accent: "from-violet-500 to-fuchsia-500",
    where: "認証場所: 受け取った招待URLを開く",
    inputLabel: "必要なら /login の「招待トークン」欄",
    inputExample: "URL内 token=... を貼り付け",
    actionLabel: "「招待トークンで入る」を押す",
  },
];

function getSceneByElapsed(ms: number): Scene {
  let current = SCENES[0]!;
  for (const scene of SCENES) {
    if (ms >= scene.atMs) current = scene;
  }
  return current;
}

export default function DemoOneMinutePage() {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const startedAt = Date.now() - elapsed;
    const id = window.setInterval(() => {
      const next = Date.now() - startedAt;
      if (next >= TOTAL_MS) {
        setElapsed(TOTAL_MS);
        setPlaying(false);
        return;
      }
      setElapsed(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, elapsed]);

  const scene = useMemo(() => getSceneByElapsed(elapsed), [elapsed]);
  const progress = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const sec = Math.floor(elapsed / 1000);
  const remaining = Math.max(0, 60 - sec);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h1 className="text-2xl font-black sm:text-3xl">1分デモ（自動再生）</h1>
          <p className="mt-2 text-sm text-slate-300">
            看護師ログイン → 招待URL発行 → 患者呼び出し → 家族確認までを60秒で確認できます。
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-400 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{sec}s / 60s</span>
            <span>残り {remaining}s</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className={`h-2 bg-gradient-to-r ${scene.accent}`} />
            <div className="p-6">
              <p className="text-xs font-black tracking-widest text-cyan-300">NOW PLAYING</p>
              <h2 className="mt-2 text-3xl font-black leading-tight">{scene.title}</h2>
              <p className="mt-2 text-lg text-slate-300">{scene.subtitle}</p>
              <p className="mt-5 text-sm leading-relaxed text-slate-400">{scene.detail}</p>
              <div className="mt-5 rounded-2xl border border-cyan-900/70 bg-slate-950/60 p-4 text-sm">
                <p className="font-bold text-cyan-300">{scene.where}</p>
                <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">{scene.inputLabel}</p>
                  <div className="mt-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200">
                    {scene.inputExample}
                  </div>
                  <div className="mt-3 rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs font-bold text-emerald-300">
                    {scene.actionLabel}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                {SCENES.map((s, idx) => {
                  const active = s.title === scene.title;
                  return (
                    <div
                      key={s.title}
                      className={`rounded-2xl border px-3 py-3 transition ${
                        active
                          ? "border-cyan-400 bg-cyan-500/10 text-cyan-100"
                          : "border-slate-700 bg-slate-800/70 text-slate-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Scene {idx + 1}</p>
                      <p className="mt-1 font-semibold">{s.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <h3 className="text-sm font-black tracking-widest text-slate-300">迷わない手順</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-300">
              <li><code>/login</code> でパスコード認証</li>
              <li><code>/dashboard/nurse</code> で招待URL発行</li>
              <li>患者は <code>/kiyoko</code> で操作</li>
              <li>家族は招待URLで閲覧</li>
            </ol>

            <h3 className="mt-6 text-sm font-black tracking-widest text-slate-300">クイックリンク</h3>
            <div className="mt-3 space-y-2 text-sm">
              <p><code>/login</code> 看護師入口</p>
              <p><code>/dashboard/nurse</code> 看護師画面</p>
              <p><code>/kiyoko</code> 患者画面</p>
              <p><code>/dashboard/family</code> 家族画面</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setElapsed(0);
                  setPlaying(true);
                }}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-white hover:bg-cyan-600"
              >
                先頭から再生
              </button>
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-black text-slate-200 hover:bg-slate-700"
              >
                {playing ? "一時停止" : "再開"}
              </button>
            </div>
            <Link
              href="/demo"
              className="mt-6 inline-block text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            >
              既存の画面デモ（/demo）を見る
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
