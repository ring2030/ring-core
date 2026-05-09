"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CHAPTERS, TOUR_TOTAL_SEC, type ChapterId } from "@/lib/tour/schedule";
import { Chapter0Intro } from "./Chapter0Intro";

// Lazy-load heavier chapters; intro is critical so we keep it static.
const Chapter1Nurse = dynamic(
  () => import("./Chapter1Nurse").then((m) => m.Chapter1Nurse),
  { ssr: false },
);
const Chapter2Family = dynamic(
  () => import("./Chapter2Family").then((m) => m.Chapter2Family),
  { ssr: false },
);
const Chapter3Connection = dynamic(
  () => import("./Chapter3Connection").then((m) => m.Chapter3Connection),
  { ssr: false },
);
const Chapter4Outro = dynamic(
  () => import("./Chapter4Outro").then((m) => m.Chapter4Outro),
  { ssr: false },
);

const TICK_MS = 100;

export function TourFrame() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // started=false → Chapter 0 wait gate.
  const [started, setStarted] = useState(false);
  const [chapter, setChapter] = useState<ChapterId>(0);
  // Seconds elapsed inside the current chapter.
  const [chapterElapsed, setChapterElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Cumulative elapsed across the 60-second tour timeline, derived from
  // current chapter + within-chapter elapsed. Avoids a separate state +
  // effect-sync that triggers cascading renders.
  const tourElapsed = useMemo(() => {
    if (!started || chapter === 0) return 0;
    const summedBefore = CHAPTERS.filter((c) => c.id > 0 && c.id < chapter).reduce(
      (acc, c) => acc + c.durationSec,
      0,
    );
    const here = CHAPTERS.find((c) => c.id === chapter)?.durationSec ?? 0;
    return Math.min(TOUR_TOTAL_SEC, summedBefore + Math.min(chapterElapsed, here));
  }, [started, chapter, chapterElapsed]);

  // Refs for stable callbacks read inside intervals / key handlers.
  const chapterRef = useRef<ChapterId>(0);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /** Hard restart back to Chapter 0 wait state. */
  const restart = useCallback(() => {
    setStarted(false);
    setChapter(0);
    setChapterElapsed(0);
    setPaused(false);
  }, []);

  /** Advance to next chapter, or end after Chapter 4. */
  const goNext = useCallback(() => {
    setChapterElapsed(0);
    setChapter((current) => {
      if (current === 0) {
        // First start
        return 1;
      }
      if (current >= 4) return 4; // already at outro
      return ((current + 1) as ChapterId);
    });
  }, []);

  const goPrev = useCallback(() => {
    setChapterElapsed(0);
    setChapter((current) => {
      if (current <= 1) return 1;
      return (current - 1) as ChapterId;
    });
  }, []);

  /** Begin the tour: leave Chapter 0 gate and enter Chapter 1. */
  const start = useCallback(() => {
    if (startedRef.current) return;
    setStarted(true);
    setChapter(1);
    setChapterElapsed(0);
    setPaused(false);
  }, []);

  // Timer loop. Runs only after started and unpaused, advances time inside
  // the active chapter and triggers chapter changes.
  useEffect(() => {
    if (!started) return;
    if (paused) return;
    if (chapter === 0) return;
    const handle = window.setInterval(() => {
      setChapterElapsed((prev) => {
        const meta = CHAPTERS.find((c) => c.id === chapterRef.current);
        const dur = meta?.durationSec ?? 0;
        const next = prev + TICK_MS / 1000;
        if (next >= dur) {
          // Roll over to next chapter (microtask defers double setState).
          if (chapterRef.current >= 4) {
            return dur;
          }
          queueMicrotask(() => {
            setChapter((c) => (c >= 4 ? 4 : ((c + 1) as ChapterId)));
            setChapterElapsed(0);
          });
          return dur;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(handle);
  }, [started, paused, chapter]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!startedRef.current) {
          start();
        } else {
          setPaused((p) => !p);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!startedRef.current) {
          start();
        } else {
          goNext();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (startedRef.current) goPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/");
      } else if (e.key === "r" || e.key === "R") {
        // R only meaningful at outro, but we accept anytime after start.
        if (startedRef.current) restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, start, goNext, goPrev, restart]);

  // Compute progress 0–1 for the top progress bar.
  const progress = useMemo(() => {
    if (!started) return 0;
    return Math.min(1, tourElapsed / TOUR_TOTAL_SEC);
  }, [started, tourElapsed]);

  // Pick which chapter component to render.
  const chapterEl = useMemo(() => {
    switch (chapter) {
      case 0:
        return <Chapter0Intro key="ch0" onStart={start} />;
      case 1:
        return <Chapter1Nurse key="ch1" elapsedSec={chapterElapsed} />;
      case 2:
        return <Chapter2Family key="ch2" elapsedSec={chapterElapsed} />;
      case 3:
        return <Chapter3Connection key="ch3" elapsedSec={chapterElapsed} />;
      case 4:
      default:
        return <Chapter4Outro key="ch4" />;
    }
  }, [chapter, chapterElapsed, start]);

  // Determine entry transition for the active chapter.
  const isSoft = chapter === 2 || chapter === 3;
  const transitionDuration = reducedMotion ? 0 : isSoft ? 0.3 : 0;

  return (
    <div
      role="region"
      aria-label="60-second guided tour"
      className="fixed inset-0 z-[100] h-screen w-screen overflow-hidden bg-black text-white"
    >
      {/* Top progress bar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-white/10"
      >
        <div
          className="h-full bg-gradient-to-r from-rose-400 via-rose-300 to-cyan-300 transition-[width] duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Chapter content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`chapter-${chapter}`}
          initial={
            isSoft
              ? { opacity: 0, y: -16 }
              : { opacity: 1 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={
            isSoft
              ? { opacity: 0, y: 12 }
              : { opacity: 1 }
          }
          transition={{ duration: transitionDuration, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {chapterEl}
        </motion.div>
      </AnimatePresence>

      {/* Footer hint, always visible (subtler when not started) */}
      <div className="pointer-events-none absolute bottom-3 right-4 z-30 select-none text-[10px] uppercase tracking-wider text-white/40 sm:text-xs">
        {paused ? (
          <span className="text-rose-300">Paused · press SPACE to resume</span>
        ) : (
          <span>
            Press <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/70">SPACE</kbd> to pause ·{" "}
            <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/70">→</kbd> to skip ·{" "}
            <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/70">Esc</kbd> to exit
          </span>
        )}
      </div>

      {/* Chapter label, bottom-left */}
      <div className="pointer-events-none absolute bottom-3 left-4 z-30 select-none text-[10px] uppercase tracking-wider text-white/40 sm:text-xs">
        {started && chapter > 0 ? (
          <span>
            {chapter} / 4 · {CHAPTERS.find((c) => c.id === chapter)?.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default TourFrame;
