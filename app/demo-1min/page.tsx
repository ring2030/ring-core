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
  targetPath: string;
  where: string;
  inputLabel: string;
  inputExample: string;
  actionLabel: string;
  judgePoint: string;
};

type FeedbackSummary = {
  count: number;
  avgImpactScore: number;
  avgTrustScore: number;
  adoption: {
    pilotSoonPct: number;
    needsValidationPct: number;
    notNowPct: number;
  };
};

const SCENES: Scene[] = [
  {
    atMs: 0,
    title: "1) Staff sign-in",
    subtitle: "Nurse logs in at /login",
    detail: "Staff signs in with ID and password, then opens the dashboard.",
    accent: "from-cyan-500 to-blue-500",
    targetPath: "/login",
    where: "Where: login fields on /login",
    inputLabel: "Login ID / password",
    inputExample: "e.g. ID 1 / PW 1",
    actionLabel: "Tap “Continue as staff”",
    judgePoint: "Is sign-in flow obvious in under 10 seconds?",
  },
  {
    atMs: 15_000,
    title: "2) Create invite link",
    subtitle: "Issue URL on /dashboard/nurse",
    detail: "Create a family or patient invite and share the link.",
    accent: "from-emerald-500 to-cyan-500",
    targetPath: "/dashboard/nurse",
    where: "Where: “Family / patient invite link” on /dashboard/nurse",
    inputLabel: "Name / minutes / role",
    inputExample: "e.g. Kiyoko / 180 / Family",
    actionLabel: "Tap “Create link” and copy the URL",
    judgePoint: "Can staff issue invite in one clear action?",
  },
  {
    atMs: 30_000,
    title: "3) Resident calls",
    subtitle: "Use /kiyoko or home /",
    detail: "Choosing restroom or talk updates the nurse view in real time.",
    accent: "from-amber-500 to-orange-500",
    targetPath: "/kiyoko",
    where: "Where: resident screen /kiyoko",
    inputLabel: "No typing required",
    inputExample: "Choose “Restroom” or “Hey”",
    actionLabel: "Hold gaze ~2s to send",
    judgePoint: "Does no-typing interaction feel accessible and fast?",
  },
  {
    atMs: 40_000,
    title: "4) Family checks in",
    subtitle: "Opens via /access?token=…",
    detail: "Family dashboard shows today’s activity, history, and AI note.",
    accent: "from-violet-500 to-fuchsia-500",
    targetPath: "/dashboard/family",
    where: "Where: open the invite URL you received",
    inputLabel: "Or use /login → invite token",
    inputExample: "Paste token=… from the URL",
    actionLabel: "Tap “Continue with token”",
    judgePoint: "Can family understand status in one glance?",
  },
  {
    atMs: 50_000,
    title: "5) Nurse uses feedback evidence",
    subtitle: "Back to /dashboard/nurse for operational decisions",
    detail:
      "Team reviews post-demo feedback trends (impact, trust, adoption) to prioritize rollout tasks.",
    accent: "from-cyan-500 to-emerald-500",
    targetPath: "/dashboard/nurse",
    where: "Where: nurse dashboard + demo feedback aggregate",
    inputLabel: "Decision metrics",
    inputExample: "Impact avg / Trust avg / Pilot-soon ratio",
    actionLabel: "Use metrics to decide next-week implementation",
    judgePoint: "Is data-to-action loop explicit for social deployment?",
  },
];

function getSceneByElapsed(ms: number): Scene {
  let current = SCENES[0]!;
  for (const scene of SCENES) {
    if (ms >= scene.atMs) current = scene;
  }
  return current;
}

function sceneIndex(scene: Scene): number {
  return SCENES.findIndex((s) => s.title === scene.title);
}

export default function DemoOneMinutePage() {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [impactScore, setImpactScore] = useState(4);
  const [trustScore, setTrustScore] = useState(4);
  const [adoptionIntent, setAdoptionIntent] = useState("pilot_soon");
  const [comment, setComment] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);

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
  const activeSceneIndex = useMemo(() => sceneIndex(scene), [scene]);
  const progress = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const sec = Math.floor(elapsed / 1000);
  const remaining = Math.max(0, 60 - sec);

  async function loadSummary() {
    try {
      const res = await fetch("/api/demo-feedback", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; summary?: FeedbackSummary };
      if (json.ok && json.summary) {
        setSummary(json.summary);
      }
    } catch {
      // no-op for PoC demo
    }
  }

  async function submitSurvey() {
    if (submitState === "sending") return;
    setSubmitState("sending");
    try {
      const res = await fetch("/api/demo-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          impactScore,
          trustScore,
          adoptionIntent,
          comment: comment.trim(),
          watchedSeconds: sec,
          demo: "demo-1min",
        }),
      });
      if (!res.ok) {
        setSubmitState("error");
        return;
      }
      setSubmitState("done");
      await loadSummary();
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h1 className="text-2xl font-black sm:text-3xl">One-minute walkthrough</h1>
          <p className="mt-2 text-sm text-slate-300">
            Staff login → invite → resident call → family view → nurse feedback loop, in 60 seconds.
          </p>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
            {[
              "Problem: slow, fragmented nurse-call flow",
              "Approach: one connected patient-staff-family loop",
              "Impact: faster response, calmer residents, visible trust",
            ].map((line) => (
              <div key={line} className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-300">
                {line}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-amber-700/40 bg-amber-900/15 px-3 py-2 text-xs text-amber-100">
            Mission: capture structured nurse-call reasons and outcomes as evidence for safe, large-scale social deployment.
          </div>
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
                  <div className="mt-2 rounded-lg border border-violet-700/50 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-violet-200">
                    Judge point: {scene.judgePoint}
                  </div>
                  <Link
                    href={scene.targetPath}
                    className="mt-3 inline-flex rounded-lg border border-cyan-400/70 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    Open this scene now ({scene.targetPath})
                  </Link>
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

              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs font-black tracking-widest text-slate-400">AUTO FOCUS MAP</p>
                <p className="mt-1 text-xs text-slate-400">
                  The glowing card shows where judges should look right now.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "/login", hint: "Staff sign-in" },
                    { label: "/dashboard/nurse", hint: "Invite + live board" },
                    { label: "/kiyoko", hint: "Resident call" },
                    { label: "/dashboard/family", hint: "Family view" },
                    { label: "/dashboard/nurse", hint: "Feedback to action" },
                  ].map((item, idx) => {
                    const active = idx === activeSceneIndex;
                    return (
                      <div
                        key={`${item.label}-${idx}`}
                        className={`rounded-xl border px-3 py-3 transition ${
                          active
                            ? "border-cyan-400 bg-cyan-500/15 shadow-[0_0_0_2px_rgba(34,211,238,0.25)]"
                            : "border-slate-700 bg-slate-900/80"
                        }`}
                      >
                        <p className={`text-xs font-black ${active ? "text-cyan-200" : "text-slate-300"}`}>
                          {item.label}
                        </p>
                        <p className={`mt-1 text-[11px] ${active ? "text-cyan-100" : "text-slate-500"}`}>
                          {item.hint}
                        </p>
                      </div>
                    );
                  })}
                </div>
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
              <li>
                Nurse returns to <code>/dashboard/nurse</code> and sets next actions from feedback data
              </li>
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
              <p>
                <code>/dashboard/nurse</code> — feedback-driven operations
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
            <div className="mt-5 rounded-2xl border border-violet-700/40 bg-violet-900/20 px-3 py-3 text-xs text-violet-100">
              <p className="font-bold">Judging highlights</p>
              <p className="mt-1">- Companion tone mode (calm / empathy / urgent)</p>
              <p>- Care relief score with day-over-day delta</p>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-700/40 bg-emerald-900/15 px-3 py-3 text-xs text-emerald-100">
              <p className="font-bold">Trust & safety checkpoints</p>
              <p className="mt-1">- Hospital data scope isolation</p>
              <p>- Role-based admin protection</p>
              <p>- Audit log + CSV evidence export</p>
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-700/40 bg-cyan-900/10 px-3 py-3 text-xs text-cyan-100">
              <p className="font-bold">30-sec post-demo survey (for social implementation evidence)</p>
              <p className="mt-1 text-cyan-200/90">
                This collects decision-grade feedback to improve rollout quality and adoption speed.
              </p>
              <div className="mt-3 rounded-lg border border-cyan-700/40 bg-slate-950/70 px-3 py-2">
                <p className="text-[11px] font-bold text-cyan-200">Quick aggregate</p>
                {summary ? (
                  <div className="mt-1 space-y-1 text-[11px] text-cyan-100">
                    <p>Responses: {summary.count}</p>
                    <p>
                      Avg impact: {summary.avgImpactScore.toFixed(2)} / 5 | Avg trust:{" "}
                      {summary.avgTrustScore.toFixed(2)} / 5
                    </p>
                    <p>
                      Adoption intent: Pilot soon {summary.adoption.pilotSoonPct}% / Validate more{" "}
                      {summary.adoption.needsValidationPct}% / Not now {summary.adoption.notNowPct}%
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-cyan-200/80">No aggregate loaded yet.</p>
                )}
                <button
                  type="button"
                  onClick={loadSummary}
                  className="mt-2 rounded-md border border-cyan-500/60 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                  Refresh aggregate
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-[11px] text-cyan-200">1) Operational impact (1-5)</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={impactScore}
                    onChange={(e) => setImpactScore(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="text-[11px] text-cyan-300">Score: {impactScore}</span>
                </label>
                <label className="block">
                  <span className="text-[11px] text-cyan-200">2) Trust / safety confidence (1-5)</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={trustScore}
                    onChange={(e) => setTrustScore(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="text-[11px] text-cyan-300">Score: {trustScore}</span>
                </label>
                <label className="block">
                  <span className="text-[11px] text-cyan-200">3) Adoption timeline</span>
                  <select
                    value={adoptionIntent}
                    onChange={(e) => setAdoptionIntent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-slate-950 px-2 py-1 text-[11px] text-cyan-100"
                  >
                    <option value="pilot_soon">Pilot soon (within 3 months)</option>
                    <option value="needs_validation">Needs more validation</option>
                    <option value="not_now">Not now</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-cyan-200">4) One critical comment (optional)</span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What blocks real-world use the most?"
                    className="mt-1 min-h-16 w-full rounded-lg border border-cyan-700/50 bg-slate-950 px-2 py-1 text-[11px] text-cyan-100 placeholder:text-slate-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitSurvey}
                  disabled={submitState === "sending" || submitState === "done"}
                  className="rounded-lg border border-cyan-400/70 bg-cyan-500/20 px-3 py-1.5 text-[11px] font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitState === "sending"
                    ? "Sending..."
                    : submitState === "done"
                      ? "Submitted"
                      : "Submit 30-sec survey"}
                </button>
                {submitState === "error" ? (
                  <p className="text-[11px] text-rose-300">Submission failed. Please retry.</p>
                ) : null}
              </div>
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
