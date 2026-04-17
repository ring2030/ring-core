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
    title: "1) Staff sign-in",
    subtitle: "Nurse logs in at /login",
    detail: "Staff signs in with ID and password, then opens the dashboard.",
    accent: "from-cyan-500 to-blue-500",
    where: "Where: login fields on /login",
    inputLabel: "Login ID / password",
    inputExample: "e.g. ID 1 / PW 1",
    actionLabel: "Tap “Continue as staff”",
  },
  {
    atMs: 15_000,
    title: "2) Create invite link",
    subtitle: "Issue URL on /dashboard/nurse",
    detail: "Create a family or patient invite and share the link.",
    accent: "from-emerald-500 to-cyan-500",
    where: "Where: “Family / patient invite link” on /dashboard/nurse",
    inputLabel: "Name / minutes / role",
    inputExample: "e.g. Kiyoko / 180 / Family",
    actionLabel: "Tap “Create link” and copy the URL",
  },
  {
    atMs: 30_000,
    title: "3) Resident calls",
    subtitle: "Use /kiyoko or home /",
    detail: "Choosing restroom or talk updates the nurse view in real time.",
    accent: "from-amber-500 to-orange-500",
    where: "Where: resident screen /kiyoko",
    inputLabel: "No typing required",
    inputExample: "Choose “Restroom” or “Hey”",
    actionLabel: "Hold gaze ~2s to send",
  },
  {
    atMs: 45_000,
    title: "4) Family checks in",
    subtitle: "Opens via /access?token=…",
    detail: "Family dashboard shows today’s activity, history, and AI note.",
    accent: "from-violet-500 to-fuchsia-500",
    where: "Where: open the invite URL you received",
    inputLabel: "Or use /login → invite token",
    inputExample: "Paste token=… from the URL",
    actionLabel: "Tap “Continue with token”",
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
          <h1 className="text-2xl font-black sm:text-3xl">One-minute walkthrough</h1>
          <p className="mt-2 text-sm text-slate-300">
            Staff login → invite → resident call → family view, in 60 seconds.
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-400 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{sec}s / 60s</span>
            <span>{remaining}s left</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className={`h-2 bg-gradient-to-r ${scene.accent}`} />
            <div className="p-6">
              <p className="text-xs font-black tracking-widest text-cyan-300">NOW PLAYING</p>
              <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{scene.title}</h2>
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
                      <p className="mt-1 line-clamp-2 font-semibold">{s.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <h3 className="text-sm font-black tracking-widest text-slate-300">Quick steps</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-300">
              <li>
                <code>/login</code> — staff sign-in
              </li>
              <li>
                <code>/dashboard/nurse</code> — create invite
              </li>
              <li>
                Resident uses <code>/kiyoko</code>
              </li>
              <li>Family opens the invite URL</li>
            </ol>

            <h3 className="mt-6 text-sm font-black tracking-widest text-slate-300">Links</h3>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <code>/login</code> — staff
              </p>
              <p>
                <code>/dashboard/nurse</code> — nurse
              </p>
              <p>
                <code>/kiyoko</code> — resident
              </p>
              <p>
                <code>/dashboard/family</code> — family
              </p>
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
                Play from start
              </button>
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-black text-slate-200 hover:bg-slate-700"
              >
                {playing ? "Pause" : "Resume"}
              </button>
            </div>
            <Link
              href="/demo"
              className="mt-6 inline-block text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            >
              Open screen-record demo (/demo)
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
