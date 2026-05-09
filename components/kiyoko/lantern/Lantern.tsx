"use client";

import { motion, useReducedMotion } from "framer-motion";

export type LanternState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  state: LanternState;
  /** 0–1 microphone RMS, used while in `listening` state. */
  micVolume: number;
  /** 0–1 synth volume, used while in `speaking` state. */
  ttsVolume: number;
  /** Briefly tints the core white during emergency flashes. */
  emergency?: boolean;
};

/**
 * Kiyoko's Lantern — a three-layer light that signals AI state at a glance.
 *
 *   - core       : the "I'm here" pilot light (~96px)
 *   - innerRing  : the "face" boundary (~340px) — eyes & mouth live inside it
 *   - outerAura  : the "presence" glow that breathes outward (~520px)
 *
 * Each layer animates independently. Volume mapping (mic / TTS) drives a
 * smooth "alive" reaction so the patient can tell within <1s whether the
 * system is hearing them or speaking back. The volume sources already smooth
 * their own output (analyser smoothingTimeConstant + low-pass on the TTS
 * synthetic curve), so this layer just consumes the props directly.
 */
export function Lantern({ state, micVolume, ttsVolume, emergency }: Props) {
  const reduce = useReducedMotion();
  const mic = micVolume;
  const tts = ttsVolume;

  // ---- Core layer ----
  const coreScale = (() => {
    if (reduce) return 1;
    if (state === "listening") return 1.0 + mic * 0.3;
    if (state === "speaking") return 1.0 + tts * 0.25;
    if (state === "thinking") return 0.85;
    return 1;
  })();
  const coreOpacity = (() => {
    if (state === "thinking") return 0.95;
    if (state === "listening") return 0.7 + mic * 0.3;
    if (state === "speaking") return 0.85 + tts * 0.15;
    return 0.85;
  })();
  const coreFill = emergency ? "#f8fafc" : "#fef9c3";

  // ---- Inner ring layer ----
  const innerScale = (() => {
    if (reduce) return 1;
    if (state === "listening") return 1.0 + mic * 0.04;
    if (state === "speaking") return 1.0 + tts * 0.04 + 0.02;
    if (state === "thinking") return 0.97;
    return 1;
  })();

  // ---- Outer aura layer ----
  const auraScale = (() => {
    if (reduce) return 1;
    if (state === "listening") return 1.0 + mic * 0.18;
    if (state === "speaking") return 1.05 + tts * 0.15;
    if (state === "thinking") return 0.96;
    return 1;
  })();
  const auraOpacity = (() => {
    if (state === "listening") return 0.18 + mic * 0.4;
    if (state === "speaking") return 0.22 + tts * 0.3;
    if (state === "thinking") return 0.15;
    return 0.15;
  })();

  // ---- Eyes (closed-ish in thinking, slits in listening, soft open elsewhere) ----
  const eyeHeight =
    state === "thinking"
      ? 1
      : state === "listening"
        ? 3
        : 7;

  // ---- Mouth ----
  // listening / idle → flat thin line
  // thinking         → 3 dots (rendered separately)
  // speaking         → opens with TTS volume (height map 6→26px)
  const mouthHeight = state === "speaking" ? 6 + tts * 26 : 3;

  return (
    <div className="relative flex items-center justify-center w-[min(72vmin,560px)] h-[min(72vmin,560px)]">
      {/* outerAura — diffuse presence glow */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: "min(70vmin,520px)",
          height: "min(70vmin,520px)",
          background:
            "radial-gradient(circle, rgba(254,240,138,0.55) 0%, rgba(251,191,36,0.18) 45%, rgba(0,0,0,0) 75%)",
          filter: "blur(28px)",
        }}
        animate={
          reduce
            ? { scale: 1, opacity: auraOpacity }
            : state === "idle"
              ? {
                  scale: [1, 1.05, 1],
                  opacity: [0.1, 0.2, 0.1],
                }
              : { scale: auraScale, opacity: auraOpacity }
        }
        transition={
          state === "idle" && !reduce
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 90, damping: 20 }
        }
      />

      {/* listening ripples */}
      {state === "listening" && !reduce && (
        <>
          <motion.div
            aria-hidden
            className="absolute rounded-full border border-amber-200/40"
            style={{ width: "min(48vmin,360px)", height: "min(48vmin,360px)" }}
            animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute rounded-full border border-amber-100/35"
            style={{ width: "min(48vmin,360px)", height: "min(48vmin,360px)" }}
            animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1.4 }}
          />
        </>
      )}

      {/* innerRing — the "face" */}
      <motion.div
        aria-hidden
        className="relative rounded-full border border-amber-100/30"
        style={{
          width: "min(48vmin,340px)",
          height: "min(48vmin,340px)",
          background:
            "radial-gradient(circle, rgba(254,243,199,0.18) 0%, rgba(120,53,15,0.08) 60%, rgba(15,23,42,0.0) 90%)",
          boxShadow: "0 0 60px rgba(254,240,138,0.18) inset",
          opacity: 0.95,
        }}
        animate={{ scale: innerScale }}
        transition={{ type: "spring", stiffness: 110, damping: 18 }}
      >
        {/* eyes */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex w-[44%] items-center justify-between" style={{ marginTop: "-6%" }}>
            <motion.div
              className="rounded-full bg-amber-100/85"
              style={{ width: 14 }}
              animate={{ height: eyeHeight }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              aria-hidden
            />
            <motion.div
              className="rounded-full bg-amber-100/85"
              style={{ width: 14 }}
              animate={{ height: eyeHeight }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              aria-hidden
            />
          </div>
        </div>

        {/* mouth: dots when thinking, line otherwise */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: "26%" }}
          aria-hidden
        >
          {state === "thinking" ? (
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block size-2 rounded-full bg-amber-100/80"
                  animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          ) : (
            <motion.div
              className="rounded-full bg-amber-100/85"
              style={{ width: 56 }}
              animate={{ height: mouthHeight }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
            />
          )}
        </div>
      </motion.div>

      {/* core — pilot light */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: 96,
          height: 96,
          background: `radial-gradient(circle, ${coreFill} 0%, rgba(251,191,36,0.7) 60%, rgba(0,0,0,0) 100%)`,
          filter: "blur(2px)",
          mixBlendMode: "screen",
        }}
        animate={
          reduce
            ? { scale: 1, opacity: coreOpacity }
            : state === "idle"
              ? {
                  scale: [1.0, 1.1, 1.0],
                  opacity: [0.6, 0.9, 0.6],
                }
              : state === "thinking"
                ? {
                    scale: [coreScale, coreScale * 1.06, coreScale],
                    opacity: [coreOpacity, coreOpacity * 0.85, coreOpacity],
                  }
                : { scale: coreScale, opacity: coreOpacity }
        }
        transition={
          state === "idle" && !reduce
            ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
            : state === "thinking" && !reduce
              ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              : { type: "spring", stiffness: 180, damping: 16 }
        }
      />
    </div>
  );
}
