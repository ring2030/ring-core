"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import {
  detectLanguage,
  toBCP47,
  type ConvLang,
} from "@/lib/i18n/detectLanguage";
import type { TriageResponse } from "@/app/api/chat/route";

export type LanternState = "idle" | "listening" | "thinking" | "speaking";

export type UseVoiceConversationParams = {
  /** When true, run the voice conversation session */
  active: boolean;
  currentCallIdRef: React.MutableRefObject<string | null>;
  conversationHistoryRef: React.MutableRefObject<{ role: string; text: string }[]>;
  conversationTurnRef: React.MutableRefObject<number>;
  /** Called when the session fully ends (after farewell TTS) */
  onEnd: () => void;
};

export type UseVoiceConversationResult = {
  /** Lantern state used to drive all visual and microcopy decisions. */
  state: LanternState;
  /** AI's spoken line (typewriter source). Empty while idle/listening. */
  aiText: string;
  /** Conversation language detected from the most recent meaningful turn. */
  lang: ConvLang;
  /** Last response priority (1–5). 4–5 triggers the emergency flash. */
  priority: number;
  /** Monotonic counter; bumps once per priority>=4 response so consumers can flash. */
  emergencyTrigger: number;
  /** True only while SpeechSynthesis is actively producing sound. */
  ttsSpeaking: boolean;
};

const SILENCE_FAREWELL_MS = 10_000;
const PARTIAL_SILENCE_MS = 3_500;
const MAX_TURNS = 10;

const FAREWELLS: Record<ConvLang, readonly string[]> = {
  ja: [
    "また話したくなったら呼んでね。",
    "ゆっくり休んでね。ここにいるよ。",
    "いつでもそばにいるからね。",
  ],
  en: [
    "Call me again whenever you'd like. I'll be right here.",
    "Take care. I'm here whenever you need me.",
    "Rest well. Just say my name when you'd like to talk again.",
  ],
} as const;

const OPENING_LINE: Record<ConvLang, string> = {
  ja: "きよ子さん、ここにいるよ。どうしたの?",
  en: "Hello Kiyoko, I'm right here. What's on your mind?",
};

function pickFrom<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

function pickVoice(lang: ConvLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  if (lang === "ja") {
    return (
      voices.find(
        (v) => v.lang === "ja-JP" && /haruka|nanami|kyoko|sayaka|female|woman/i.test(v.name),
      ) ??
      voices.find((v) => v.lang === "ja-JP") ??
      voices.find((v) => v.lang.startsWith("ja"))
    );
  }
  return (
    voices.find(
      (v) => v.lang === "en-US" && /zira|aria|samantha|jenny|emma|female|woman/i.test(v.name),
    ) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice session orchestrator for "Kiyoko's Lantern".
 *
 * Drives a 4-state machine (idle → listening → thinking → speaking → idle…)
 * over Web Speech STT + /api/chat (Gemini) + SpeechSynthesis TTS, and detects
 * the patient's language each turn so every reply (LLM, TTS, fallback,
 * farewell) mirrors what she just said.
 */
export function useVoiceConversation({
  active,
  currentCallIdRef,
  conversationHistoryRef,
  conversationTurnRef,
  onEnd,
}: UseVoiceConversationParams): UseVoiceConversationResult {
  const [state, setState] = useState<LanternState>("idle");
  const [aiText, setAiText] = useState("");
  const [lang, setLang] = useState<ConvLang>("ja");
  const [priority, setPriority] = useState(1);
  const [emergencyTrigger, setEmergencyTrigger] = useState(0);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    if (!active) {
      // Defer setState calls out of effect body for React 19 strict mode.
      void Promise.resolve().then(() => {
        setState("idle");
        setAiText("");
        setTtsSpeaking(false);
      });
      return;
    }

    const synth = window.speechSynthesis;
    const SR = getSpeechRecognitionCtor();
    const recognition: SpeechRecognition | null = SR ? new SR() : null;

    let mounted = true;
    let shouldContinue = true;
    let latestLang: ConvLang = "ja";
    let speechBuffer = "";
    let inFlight = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearDebounce = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
    const clearSilence = () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    };

    const startListeningCycle = () => {
      if (!mounted || !shouldContinue || inFlight || !recognition) return;
      speechBuffer = "";
      clearDebounce();
      // Open mic and wait for speech. We stay in 'idle' visually until the
      // patient actually starts talking — that's what the lantern wants.
      setState("idle");
      try {
        recognition.start();
      } catch {
        /* already running */
      }
      clearSilence();
      silenceTimer = setTimeout(() => {
        if (!mounted || !shouldContinue) return;
        speakFarewell();
      }, SILENCE_FAREWELL_MS);
    };

    const speak = (
      text: string,
      utteranceLang: ConvLang,
      onComplete: () => void,
    ) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = toBCP47(utteranceLang);
      u.rate = utteranceLang === "ja" ? 0.95 : 0.92;
      u.pitch = 1.0;
      const v = pickVoice(utteranceLang);
      if (v) u.voice = v;

      u.onstart = () => {
        if (!mounted) return;
        setTtsSpeaking(true);
        setState("speaking");
      };
      u.onend = () => {
        if (!mounted) return;
        setTtsSpeaking(false);
        onComplete();
      };
      u.onerror = () => {
        if (!mounted) return;
        setTtsSpeaking(false);
        onComplete();
      };

      synth.cancel();
      synth.speak(u);
    };

    const speakFarewell = () => {
      if (!mounted || !shouldContinue) return;
      shouldContinue = false;
      clearDebounce();
      clearSilence();
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      const farewell = pickFrom(FAREWELLS[latestLang], FAREWELLS[latestLang][0]!);
      setAiText(farewell);
      speak(farewell, latestLang, () => {
        if (mounted) onEndRef.current();
      });
    };

    const speakAndListen = (text: string, replyLang: ConvLang) => {
      if (!mounted || !shouldContinue) return;
      clearDebounce();
      clearSilence();
      speechBuffer = "";
      setAiText(text);
      speak(text, replyLang, () => {
        if (mounted && shouldContinue) {
          // Brief pause after AI speaks before reopening mic — feels more human.
          setTimeout(() => {
            if (mounted && shouldContinue) startListeningCycle();
          }, 400);
        }
      });
    };

    const speakAndFinish = (text: string, replyLang: ConvLang) => {
      if (!mounted) return;
      shouldContinue = false;
      clearDebounce();
      clearSilence();
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      setAiText(text);
      speak(text, replyLang, () => {
        if (mounted) onEndRef.current();
      });
    };

    const sendToApi = async (finalText: string) => {
      if (!mounted || !shouldContinue || inFlight) return;
      inFlight = true;
      setState("thinking");
      setAiText("");
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }

      if (conversationTurnRef.current >= MAX_TURNS) {
        const cap =
          latestLang === "ja"
            ? "看護師さんに伝えました。少し休んでね。"
            : "I've passed your message to the nurse team. Rest for a bit.";
        speakAndFinish(cap, latestLang);
        return;
      }
      conversationTurnRef.current += 1;

      // Detect from the user's actual transcript so the AI mirrors the
      // language they just used (independent of recognition.lang).
      const userLang = detectLanguage(finalText);
      latestLang = userLang;
      setLang(userLang);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: finalText,
            history: conversationHistoryRef.current,
          }),
        });
        const data: TriageResponse = await res.json();
        if (!mounted) return;

        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: "user", text: finalText },
          { role: "model", text: data.response },
        ];

        const callId = currentCallIdRef.current;
        if (callId) {
          updateDoc(doc(getFirestoreDb(), "calls", callId), {
            aiSummary: data.summary,
            priority: data.priority,
            // Keep legacy bilingual aliases on the call record.
            要約: data.summary,
            緊急度: data.priority,
          }).catch(() => {});
        }

        // Reply may be in either language regardless of input — trust the model.
        const replyLang = detectLanguage(data.response) || userLang;
        latestLang = replyLang;
        setLang(replyLang);
        setPriority(data.priority);
        if (data.priority >= 4) setEmergencyTrigger((n) => n + 1);

        inFlight = false;

        // Adjust STT language to match the user's preferred language so the
        // next turn's transcription quality stays high.
        if (recognition) recognition.lang = toBCP47(userLang);

        if (data.priority >= 4) {
          speakAndFinish(data.response, replyLang);
        } else {
          speakAndListen(data.response, replyLang);
        }
      } catch {
        if (!mounted) return;
        inFlight = false;
        const fallback =
          latestLang === "ja"
            ? "ちょっと聞こえにくかった。もう一度話してくれる?"
            : "I had trouble hearing that. Could you say it again?";
        speakAndListen(fallback, latestLang);
      }
    };

    if (recognition) {
      recognition.lang = "ja-JP";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!mounted || !shouldContinue || inFlight) return;
        // Any non-empty interim or final result means the patient is talking:
        // clear the silence-farewell timer and surface the lantern's "listening" face.
        clearSilence();
        setState("listening");

        let interim = "";
        let finalAdd = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const row = event.results[i];
          if (!row) continue;
          const piece = row[0]?.transcript ?? "";
          if (row.isFinal) {
            finalAdd += piece;
          } else {
            interim += piece;
          }
        }
        if (finalAdd) {
          speechBuffer = `${speechBuffer} ${finalAdd}`.trim();
        }
        const display = `${speechBuffer}${interim ? " " + interim : ""}`.trim();

        // Update language detection live, so the badge follows the user's mid-speech change.
        if (display.length >= 2) {
          const inferred = detectLanguage(display);
          if (inferred !== latestLang) {
            latestLang = inferred;
            setLang(inferred);
          }
        }

        clearDebounce();
        debounceTimer = setTimeout(() => {
          if (!mounted || !shouldContinue || inFlight) return;
          const finalText = (speechBuffer || display).replace(/\s+/g, " ").trim();
          if (finalText.length < 2) {
            // Too short — keep listening.
            setState("idle");
            speechBuffer = "";
            clearSilence();
            silenceTimer = setTimeout(() => {
              if (!mounted || !shouldContinue) return;
              speakFarewell();
            }, SILENCE_FAREWELL_MS);
            return;
          }
          void sendToApi(finalText);
        }, PARTIAL_SILENCE_MS);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldContinue = false;
          const msg =
            latestLang === "ja"
              ? "マイクの使用が許可されていないみたい。設定を見てみてね。"
              : "Microphone permission is required. Please check your browser settings.";
          speakAndFinish(msg, latestLang);
          return;
        }
      };

      recognition.onend = () => {
        if (!mounted || !shouldContinue || inFlight) return;
        // Auto-restart so we keep listening across browser-imposed end events.
        setTimeout(() => {
          if (mounted && shouldContinue && !inFlight) {
            try {
              recognition.start();
            } catch {
              /* already running */
            }
          }
        }, 80);
      };
    }

    // Kick off with the bilingual opening (initial language: JA).
    setTimeout(() => {
      if (!mounted || !shouldContinue) return;
      const opening = OPENING_LINE.ja;
      latestLang = "ja";
      setLang("ja");
      setAiText(opening);
      speak(opening, "ja", () => {
        if (mounted && shouldContinue) startListeningCycle();
      });
    }, 600);

    return () => {
      mounted = false;
      shouldContinue = false;
      clearDebounce();
      clearSilence();
      synth.cancel();
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { state, aiText, lang, priority, emergencyTrigger, ttsSpeaking };
}
