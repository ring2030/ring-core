"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";

/** Total scripted length (ms) — ~20s */
export const DEMO_TOTAL_MS = 20_000;

const T = {
  CURSOR_MOVE_START: 150,
  /** Cursor lands on Chat quickly; gauge starts here too. */
  CURSOR_ARRIVE: 700,
  GAUGE_START: 700,
  /** Longer dwell so the fill feels gradual (じわじわ). SUBMIT − GAUGE_START ≈ 7.8s */
  SUBMIT: 8500,
  VIDEO_END: 15_200,
  NURSE_END: 18_200,
} as const;

/** After video UI appears, wait this long before scripted line + mic “recognition” start. */
const VIDEO_TO_DEMO_LINE_MS = 2000;
const DEMO_SCRIPT_LINE_START_AT = T.SUBMIT + VIDEO_TO_DEMO_LINE_MS;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function demoCursorPosition(elapsed: number, w: number, h: number): { x: number; y: number } {
  const x0 = w * 0.5;
  const y0 = h * 0.72;
  const x1 = w * 0.78;
  const y1 = h * 0.52;
  if (elapsed < T.CURSOR_MOVE_START) return { x: x0, y: y0 };
  if (elapsed >= T.CURSOR_ARRIVE) {
    let x = x1;
    let y = y1;
    if (elapsed < T.SUBMIT) {
      x += Math.sin(elapsed / 180) * 5;
      y += Math.cos(elapsed / 220) * 4;
    }
    return { x, y };
  }
  const u = (elapsed - T.CURSOR_MOVE_START) / (T.CURSOR_ARRIVE - T.CURSOR_MOVE_START);
  const e = easeInOutCubic(Math.min(1, Math.max(0, u)));
  return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e };
}

/** Smoothstep: slow start & slow end (more “じわじわ” than linear). */
function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function demoProgress(elapsed: number): number {
  if (elapsed < T.GAUGE_START) return 0;
  if (elapsed >= T.SUBMIT) return 100;
  const u = (elapsed - T.GAUGE_START) / (T.SUBMIT - T.GAUGE_START);
  return smoothstep01(u) * 100;
}

function DemoMouseCursor({ x, y }: { x: number; y: number }) {
  return (
    <svg
      className="pointer-events-none fixed z-[100001] drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
      width={28}
      height={28}
      style={{ left: x - 2, top: y - 2 }}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M4 2 L4 20 L9.5 14.5 L13 22 L16 20.5 L12.5 13 L20 13 Z"
        fill="white"
        stroke="#0f172a"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

/** For highlight when full transcript matches intent (e.g. stomach pain in English) */
const PHRASE_EXPECTED = "my stomach hurts";
const REVEAL_MS_PER_CHAR = 28;
const LISTENING_REVEAL_MS = 32;

const LISTENING_LABEL = "Listening…";
const MIC_LABEL = "Mic unavailable";
const IDLE_LABEL = "Idle";

/** Scripted English line (stomach pain) — letter-by-letter after video delay. */
const STOMACH_PAIN_EN = "I have a stomach ache.";
const DEMO_LINE_MS_PER_CHAR = 30;

export function ScreenRecordDemo() {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ww, setWw] = useState(1200);
  const [wh, setWh] = useState(800);

  /** Raw text from the speech API (can jump as recognition updates). */
  const [speechTranscript, setSpeechTranscript] = useState("");
  /** How many leading characters of `speechTranscript` are shown (typewriter). */
  const [speechRevealEnd, setSpeechRevealEnd] = useState(0);
  const prevTranscriptRef = useRef("");

  const [speechListening, setSpeechListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);

  /** Typewriter for the Listening / Idle badge (video phase). */
  const [listeningRevealEnd, setListeningRevealEnd] = useState(0);

  useEffect(() => {
    const sync = () => {
      setWw(window.innerWidth);
      setWh(window.innerHeight);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    let id: number;
    const tick = (now: number) => {
      const e = now - t0;
      if (e >= DEMO_TOTAL_MS) {
        setElapsed(DEMO_TOTAL_MS);
        setPlaying(false);
        return;
      }
      setElapsed(e);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, runId]);

  const phaseKey =
    elapsed < T.SUBMIT ? "main" : elapsed < T.VIDEO_END ? "video" : elapsed < T.NURSE_END ? "nurse" : "wrap";

  /** Web Speech API — starts ~2s after video screen (same as scripted stomach line). */
  useEffect(() => {
    if (!playing || phaseKey !== "video") {
      return;
    }

    let rec: SpeechRecognition | null = null;
    let cancelled = false;

    const arm = window.setTimeout(() => {
      if (cancelled) return;

      const w = window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SR) {
        startTransition(() => {
          setSpeechUnsupported(true);
          setSpeechTranscript("(Speech recognition is not available in this browser.)");
        });
        return;
      }

      rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      const startListen = () => {
        if (cancelled || !rec) return;
        try {
          setSpeechListening(true);
          rec.start();
        } catch {
          /* already running */
        }
      };

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let line = "";
        for (let i = 0; i < event.results.length; i++) {
          line += event.results[i]?.[0]?.transcript ?? "";
        }
        const t = line.trim();
        if (t) setSpeechTranscript(t);
      };

      rec.onerror = () => {
        setSpeechListening(false);
      };

      rec.onend = () => {
        if (cancelled) return;
        setSpeechListening(false);
        setTimeout(() => {
          if (!cancelled && rec) startListen();
        }, 120);
      };

      startListen();
    }, VIDEO_TO_DEMO_LINE_MS);

    return () => {
      cancelled = true;
      clearTimeout(arm);
      setSpeechListening(false);
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        rec = null;
      }
    };
  }, [playing, phaseKey, runId]);

  /** If the model replaces or rewrites text, reset reveal so we don’t show a stale prefix. */
  useEffect(() => {
    const full = speechTranscript;
    const prev = prevTranscriptRef.current;
    setSpeechRevealEnd((end) => {
      const shown = prev.slice(0, end);
      if (full.startsWith(shown)) return Math.min(end, full.length);
      return 0;
    });
    prevTranscriptRef.current = full;
  }, [speechTranscript]);

  /** Reveal one more character until caught up with the latest transcript. */
  useEffect(() => {
    if (speechRevealEnd >= speechTranscript.length) return;
    const id = window.setTimeout(() => {
      setSpeechRevealEnd((e) => Math.min(e + 1, speechTranscript.length));
    }, REVEAL_MS_PER_CHAR);
    return () => clearTimeout(id);
  }, [speechTranscript, speechRevealEnd]);

  const listeningTarget = speechUnsupported ? MIC_LABEL : speechListening ? LISTENING_LABEL : IDLE_LABEL;

  useEffect(() => {
    startTransition(() => setListeningRevealEnd(0));
  }, [listeningTarget]);

  useEffect(() => {
    if (listeningRevealEnd >= listeningTarget.length) return;
    const id = window.setTimeout(() => {
      setListeningRevealEnd((e) => Math.min(e + 1, listeningTarget.length));
    }, LISTENING_REVEAL_MS);
    return () => clearTimeout(id);
  }, [listeningTarget, listeningRevealEnd]);

  const start = useCallback(() => {
    setElapsed(0);
    setRunId((k) => k + 1);
    setSpeechTranscript("");
    setSpeechRevealEnd(0);
    prevTranscriptRef.current = "";
    setSpeechUnsupported(false);
    setListeningRevealEnd(0);
    setPlaying(true);
  }, []);

  const cursor = useMemo(() => demoCursorPosition(elapsed, ww, wh), [elapsed, ww, wh]);
  const progress = useMemo(() => demoProgress(elapsed), [elapsed]);

  const showMain = elapsed < T.SUBMIT;
  const showSuccess = elapsed >= T.SUBMIT;

  const targetTalk = elapsed >= T.CURSOR_ARRIVE && elapsed < T.SUBMIT;
  const gazeForHalo = playing || elapsed > 0 ? cursor : { x: -100, y: -100 };

  const successMode =
    elapsed >= T.SUBMIT && elapsed < T.VIDEO_END
      ? "video"
      : elapsed >= T.VIDEO_END && elapsed < T.NURSE_END
        ? "nurse"
        : "wrap";

  const idle = !playing && elapsed === 0;
  const done = !playing && elapsed >= DEMO_TOTAL_MS;

  const speechShown = speechTranscript.slice(0, speechRevealEnd);
  const listeningShown = listeningTarget.slice(0, listeningRevealEnd);

  /** Scripted stomach line — starts VIDEO_TO_DEMO_LINE_MS after the video screen (SUBMIT). */
  const demoLineReveal = useMemo(() => {
    const startAt = T.SUBMIT + VIDEO_TO_DEMO_LINE_MS;
    if (elapsed < startAt) return 0;
    const t = elapsed - startAt;
    return Math.min(STOMACH_PAIN_EN.length, Math.floor(t / DEMO_LINE_MS_PER_CHAR));
  }, [elapsed]);

  const demoLineShown = STOMACH_PAIN_EN.slice(0, demoLineReveal);
  const low = speechTranscript.toLowerCase();
  const phraseMatched =
    low.includes(PHRASE_EXPECTED) ||
    (low.includes("stomach") && (low.includes("hurt") || low.includes("ache")));

  return (
    <div className="relative min-h-screen bg-slate-900 font-sans overflow-hidden select-none flex flex-col items-center justify-center text-slate-100">
      {(playing || (elapsed > 0 && !idle)) && (
        <div className="pointer-events-none fixed right-6 top-6 z-[100002] flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-xs text-red-400 ring-1 ring-red-500/50">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          REC
        </div>
      )}

      {idle && (
        <div className="z-10 flex max-w-lg flex-col items-center gap-8 px-6 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-100 sm:text-4xl">
            Screen recording walkthrough
          </h1>
          <p className="text-base leading-relaxed text-slate-400">
            After Start, a ~20s sequence runs: gaze on two tiles → dwell gauge → chat flow with
            microphone (English speech recognition) → nurse notice. No audio playback from the page.
            <br />
            <span className="text-slate-500">Use OBS or similar to capture the window.</span>
            <br />
            <span className="mt-3 block text-left text-sm text-slate-600">
              <strong className="text-slate-500">If the page does not load</strong>
              <br />
              Run <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">npm.cmd run dev</code>{" "}
              in this project, wait for Ready, then open the URL. Try{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">/record</code> if{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">/demo</code> is blocked.
            </span>
          </p>
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-cyan-600 px-14 py-5 text-2xl font-bold text-white shadow-lg transition hover:bg-cyan-500 active:scale-[0.98]"
          >
            Start (~20s)
          </button>
          <Link
            href="/"
            className="text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
          >
            Back to main
          </Link>
        </div>
      )}

      {!idle && (
        <>
          {showMain && (
            <div
              className="fixed h-48 w-48 animate-pulse rounded-full bg-amber-400 opacity-40 mix-blend-screen blur-2xl transition-all duration-100 pointer-events-none"
              style={{
                left: gazeForHalo.x - 96,
                top: gazeForHalo.y - 96,
                display: gazeForHalo.x > 0 ? "block" : "none",
                zIndex: 9999,
              }}
            />
          )}

          {showMain && <DemoMouseCursor x={cursor.x} y={cursor.y} />}

          {showMain && (
            <div className="absolute top-8 z-[10000] flex max-w-[min(100%,42rem)] flex-col items-center gap-2 px-4 text-center">
              <p className="inline-block rounded-full border-2 border-slate-600 bg-slate-800/90 px-6 py-3 text-lg font-bold text-slate-300 shadow-md sm:text-2xl sm:px-8">
                {playing ? "Tracking gaze…" : "Paused"}
              </p>
              <p className="font-mono text-[10px] text-slate-500 sm:text-xs">
                Tracking: OK
              </p>
            </div>
          )}

          {showMain && (
            <div className="mt-16 flex h-[70vh] w-full max-w-7xl min-h-0 flex-row items-stretch gap-6 px-4 sm:gap-8 sm:px-8 max-[640px]:h-auto max-[640px]:min-h-[50vh] max-[640px]:flex-col max-[640px]:gap-6">
              <div className="relative flex h-full min-h-[10rem] min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border-[10px] border-orange-800/50 bg-slate-800 shadow-md transition-all duration-300 sm:min-h-0 sm:rounded-[4rem] sm:border-[12px]">
                <div
                  className="absolute bottom-0 left-0 w-full bg-orange-500/35"
                  style={{ height: "0%", transition: "height 0.1s linear" }}
                />
                <span className="pointer-events-none relative z-10 max-h-full max-w-[min(100%,18ch)] overflow-hidden px-2 text-center text-[clamp(1.35rem,min(5.5vw,5.5dvh),3.75rem)] font-black leading-tight tracking-tight text-balance text-slate-100">
                  Restroom
                </span>
              </div>

              <div
                className={`relative flex h-full min-h-[10rem] min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border-[10px] transition-all duration-300 sm:min-h-0 sm:rounded-[4rem] sm:border-[12px] ${
                  targetTalk
                    ? "scale-[1.02] border-blue-500 bg-blue-950/60 shadow-[0_0_50px_rgba(59,130,246,0.25)]"
                    : "border-blue-800/50 bg-slate-800 shadow-md"
                }`}
              >
                <div
                  className="absolute bottom-0 left-0 z-0 w-full bg-blue-500/50"
                  style={{
                    height: `${targetTalk ? progress : 0}%`,
                    minHeight: targetTalk && progress > 0 ? "4px" : undefined,
                    transition: "height 0.22s ease-out",
                  }}
                />
                <span className="pointer-events-none relative z-10 max-w-full px-2 text-center text-[clamp(2rem,min(9vw,8dvh),7rem)] font-black leading-none text-slate-100">
                  Chat
                </span>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="animate-in zoom-in flex h-full w-full flex-col items-center justify-center duration-500 px-8">
              {successMode === "video" && (
                <div className="flex w-full max-w-5xl flex-col items-center">
                  <p className="mb-4 rounded-full border border-cyan-700/50 bg-cyan-950/40 px-6 py-2 text-lg font-bold text-cyan-300">
                    Video chat · speech recognition (English)
                  </p>
                  <p className="mb-6 max-w-xl text-center text-base text-slate-400">
                    About 2 seconds after this screen appears, the English line and microphone recognition
                    begin. If you are heard, &ldquo;Heard&rdquo; replaces the scripted line.
                  </p>

                  <div
                    className={`mb-6 min-h-[2.75rem] rounded-full border-2 px-6 py-2 text-lg font-bold tabular-nums ${
                      speechListening
                        ? "border-red-600 bg-red-950/50 text-red-300 animate-pulse"
                        : "border-slate-600 bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    <span className="font-mono tracking-tight">
                      {listeningShown}
                      {listeningRevealEnd < listeningTarget.length ? (
                        <span className="ml-px inline-block h-[1.1em] w-[2px] animate-pulse bg-current align-middle opacity-80" />
                      ) : null}
                    </span>
                  </div>

                  <h2 className="mb-8 min-h-[6rem] w-full text-center text-[clamp(1.5rem,4vw,2.5rem)] font-bold leading-snug text-blue-200">
                    {speechShown.length > 0 ? (
                      <>
                        <span className="text-slate-400">Heard: </span>
                        <span className={phraseMatched ? "text-emerald-400" : "text-blue-100"}>
                          &ldquo;{speechShown}
                          {(speechRevealEnd < speechTranscript.length ||
                            (speechListening &&
                              speechShown.length > 0 &&
                              speechRevealEnd >= speechTranscript.length)) && (
                            <span className="ml-px inline-block h-[1em] w-[2px] animate-pulse bg-blue-300 align-middle" />
                          )}
                          &rdquo;
                        </span>
                      </>
                    ) : (
                      <span className="block text-slate-500">
                        {speechUnsupported ? (
                          <span className="mb-3 block text-amber-200/90">Speech recognition unavailable.</span>
                        ) : null}
                        <span className="text-blue-100/95">
                          {elapsed < DEMO_SCRIPT_LINE_START_AT ? (
                            <span className="text-slate-500">Waiting… (script + mic start in a moment)</span>
                          ) : (
                            <>
                              &ldquo;{demoLineShown}
                              {demoLineReveal < STOMACH_PAIN_EN.length ? (
                                <span className="ml-px inline-block h-[1em] w-[2px] animate-pulse bg-blue-300 align-middle" />
                              ) : null}
                              &rdquo;
                            </>
                          )}
                        </span>
                      </span>
                    )}
                  </h2>

                  <div className="relative mb-8 flex w-full max-w-3xl flex-col gap-4">
                    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border-4 border-slate-600 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 shadow-2xl">
                      <div
                        className="absolute inset-0 opacity-40"
                        style={{
                          background:
                            "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 16px)",
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex gap-4">
                          <div className="h-28 w-28 rounded-full bg-gradient-to-br from-blue-400/30 to-slate-700 ring-4 ring-blue-500/40" />
                          <div className="h-28 w-28 rounded-full bg-gradient-to-br from-emerald-400/20 to-slate-700 ring-4 ring-emerald-500/30" />
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 rounded-lg bg-black/50 px-3 py-1 font-mono text-xs text-slate-400">
                        Placeholder video
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {successMode === "nurse" && (
                <div className="flex max-w-4xl flex-col items-center gap-10 text-center">
                  <div className="text-8xl" aria-hidden>
                    🩺
                  </div>
                  <h2 className="text-[clamp(1.75rem,5vw,3.5rem)] font-black leading-tight text-amber-100">
                    A nurse will be with you shortly
                  </h2>
                  <p className="text-2xl font-bold text-slate-400">Please wait a moment.</p>
                </div>
              )}

              {successMode === "wrap" && (
                <div className="flex flex-col items-center gap-6 text-center">
                  <p className="text-3xl font-bold text-slate-300">You can stop recording here</p>
                  <p className="max-w-md text-slate-500">Run again from Start if you need another take.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setElapsed(0);
                      setPlaying(false);
                    }}
                    className="rounded-full bg-slate-700 px-10 py-4 text-xl font-bold text-slate-200 hover:bg-slate-600"
                  >
                    From the top
                  </button>
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100003] -translate-x-1/2 rounded-full bg-black/70 px-5 py-2 text-sm text-slate-400">
              Sequence complete (~20s)
            </div>
          )}
        </>
      )}
    </div>
  );
}
