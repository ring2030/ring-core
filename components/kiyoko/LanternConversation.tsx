"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useMicVolume } from "@/hooks/useMicVolume";
import { useTTSVolume } from "@/hooks/useTTSVolume";
import type { ConvLang } from "@/lib/i18n/detectLanguage";
import { langLabel } from "@/lib/i18n/detectLanguage";
import { Lantern, type LanternState } from "./lantern/Lantern";
import { EmergencyFlash } from "./lantern/EmergencyFlash";

type Props = {
  state: LanternState;
  aiText: string;
  lang: ConvLang;
  priority: number;
  emergencyTrigger: number;
  ttsSpeaking: boolean;
  onEnd: () => void;
};

const TOP_COPY = {
  idle: {
    ja: "声をかけてね。聞いてるよ。",
    en: "I'm here whenever you'd like to talk.",
  },
  listening: {
    ja: "聞いてるよ。",
    en: "I'm listening.",
  },
} as const;

const MICROCOPY_THINKING = { ja: "考えてる…", en: "thinking…" } as const;
const END_LABEL = { ja: "会話を終わる", en: "End conversation" } as const;
const ARIA_STATE_LABEL = {
  idle: { ja: "AI は待機しています", en: "AI is waiting" },
  listening: { ja: "AI が聞いています", en: "AI is listening" },
  thinking: { ja: "AI が考えています", en: "AI is thinking" },
  speaking: { ja: "AI が話しています", en: "AI is speaking" },
} as const;

/** Typewriter renderer — reveals AI text 30–40ms per character. */
function Typewriter({
  text,
  active,
  startDelayMs = 300,
}: {
  text: string;
  /** When false, instantly show the full text (used for non-speaking phases). */
  active: boolean;
  startDelayMs?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState("");
  const intervalRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (delayRef.current !== null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }

    let cancelled = false;
    if (!active || reduce) {
      // Defer initial state writes so React 19's set-state-in-effect lint
      // stays happy without weakening reduced-motion behaviour.
      void Promise.resolve().then(() => {
        if (!cancelled) setShown(text);
      });
      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve().then(() => {
      if (cancelled) return;
      setShown("");
      delayRef.current = window.setTimeout(() => {
        let i = 0;
        intervalRef.current = window.setInterval(() => {
          i += 1;
          setShown(text.slice(0, i));
          if (i >= text.length && intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }, 35);
      }, startDelayMs);
    });

    return () => {
      cancelled = true;
      if (delayRef.current !== null) {
        window.clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, active, reduce, startDelayMs]);

  return <>{shown}</>;
}

/**
 * The single visual surface for "Kiyoko's Lantern". Holds the lantern itself,
 * the typewritered AI line, the bilingual microcopy, the JP/EN badge and the
 * subtle End-conversation button.
 *
 * All language-driven copy is keyed off `lang`, which the parent updates as it
 * detects the patient's most recent language.
 */
export function LanternConversation({
  state,
  aiText,
  lang,
  priority: _priority,
  emergencyTrigger,
  ttsSpeaking,
  onEnd,
}: Props) {
  const reduce = useReducedMotion();
  const micVolume = useMicVolume(state === "listening" || state === "idle");
  const ttsVolume = useTTSVolume(ttsSpeaking);

  // After speaking ends, fade out the typewriter line on the way back to idle.
  const showText = state === "speaking" || (state === "thinking" && aiText.length > 0);
  const inEmergency = state === "speaking" && _priority >= 4;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ARIA_STATE_LABEL[state][lang]}
      className="relative flex h-full w-full flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, #0a0e1a 0%, #04060c 65%, #000000 100%)",
      }}
    >
      <EmergencyFlash trigger={emergencyTrigger} />

      {/* Top-right language badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={lang}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute right-5 top-5 sm:right-7 sm:top-7"
        >
          <span
            aria-label={
              lang === "ja"
                ? "Conversation language: Japanese"
                : "Conversation language: English"
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold tracking-wider"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(6px)",
            }}
          >
            {langLabel(lang)}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Top message (idle/listening) */}
      <div className="absolute inset-x-0 top-[6vh] flex justify-center px-6 text-center sm:top-[8vh]">
        <AnimatePresence mode="wait">
          {(state === "idle" || state === "listening") && (
            <motion.p
              key={`${state}-${lang}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 0.55, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="font-light text-[clamp(0.95rem,2.4vmin,1.15rem)]"
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily:
                  "'Inter','Noto Sans JP',ui-sans-serif,system-ui,sans-serif",
                letterSpacing: lang === "ja" ? "0.02em" : "0.01em",
              }}
            >
              {state === "listening" ? TOP_COPY.listening[lang] : TOP_COPY.idle[lang]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* AI response (typewriter, only while speaking/just-resolved) */}
      <div className="pointer-events-none absolute inset-x-0 top-[16vh] flex justify-center px-6 text-center sm:top-[20vh]">
        <AnimatePresence>
          {showText && (
            <motion.p
              key={aiText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.5 }}
              aria-live="polite"
              className="max-w-3xl font-light leading-relaxed"
              style={{
                color: inEmergency ? "rgba(254,202,202,0.96)" : "rgba(255,255,255,0.95)",
                fontFamily:
                  "'Inter','Noto Sans JP',ui-sans-serif,system-ui,sans-serif",
                fontSize: "clamp(1.4rem,3.6vmin,2.4rem)",
                letterSpacing: lang === "ja" ? "0.02em" : "0.005em",
                textShadow: "0 0 24px rgba(254,240,138,0.18)",
              }}
            >
              <Typewriter text={aiText} active={state === "speaking"} />
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Lantern */}
      <div className="relative">
        <Lantern
          state={state}
          micVolume={micVolume}
          ttsVolume={ttsVolume}
          emergency={inEmergency}
        />

        {/* Below-face microcopy */}
        <div className="absolute inset-x-0 -bottom-2 flex justify-center" aria-hidden>
          <AnimatePresence mode="wait">
            {state === "thinking" && (
              <motion.span
                key="thinking-copy"
                initial={{ opacity: 0 }}
                animate={
                  reduce ? { opacity: 0.55 } : { opacity: [0.25, 0.7, 0.25] }
                }
                exit={{ opacity: 0 }}
                transition={
                  reduce
                    ? { duration: 0.4 }
                    : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                }
                className="font-light text-[clamp(0.85rem,2vmin,1rem)]"
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontFamily:
                    "'Inter','Noto Sans JP',ui-sans-serif,system-ui,sans-serif",
                }}
              >
                {MICROCOPY_THINKING[lang]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* End conversation — bottom-right, low priority */}
      <button
        type="button"
        onClick={onEnd}
        className="absolute bottom-5 right-5 rounded-full px-4 py-2 text-xs font-light transition-colors sm:bottom-7 sm:right-7"
        style={{
          color: "rgba(255,255,255,0.5)",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(4px)",
          fontFamily:
            "'Inter','Noto Sans JP',ui-sans-serif,system-ui,sans-serif",
        }}
        aria-label={END_LABEL[lang]}
      >
        {END_LABEL[lang]}
      </button>

      {/* Hidden live region for the AI text in lower-priority phases. */}
      <span className="sr-only" aria-live="polite">
        {aiText}
      </span>
    </div>
  );
}
