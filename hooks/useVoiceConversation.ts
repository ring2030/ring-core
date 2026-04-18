"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { TriageResponse } from "@/app/api/chat/route";

export type UseVoiceConversationParams = {
  /** When true, run the voice conversation session */
  active: boolean;
  currentCallIdRef: React.MutableRefObject<string | null>;
  conversationHistoryRef: React.MutableRefObject<{ role: string; text: string }[]>;
  conversationTurnRef: React.MutableRefObject<number>;
  /** Called when the session fully ends (after TTS) */
  onEnd: () => void;
};

export type UseVoiceConversationResult = {
  aiText: string;
  isListening: boolean;
  isThinking: boolean;
};

function speakUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  return u;
}

/**
 * Voice session: Web Speech API → /api/chat → TTS. English STT, UI, and spoken copy.
 */
export function useVoiceConversation({
  active,
  currentCallIdRef,
  conversationHistoryRef,
  conversationTurnRef,
  onEnd,
}: UseVoiceConversationParams): UseVoiceConversationResult {
  const [aiText, setAiText] = useState("Getting your companion ready…");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    if (!active) return;

    const w = window as Window;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const recognition: SpeechRecognition | null = SR ? new SR() : null;
    const synth = window.speechSynthesis;

    let mounted = true;
    let shouldContinueConversation = true;
    let thinking = false;
    let speechBuffer = "";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;

    const clearDebounce = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
    const clearNoSpeech = () => {
      if (noSpeechTimer) {
        clearTimeout(noSpeechTimer);
        noSpeechTimer = null;
      }
    };

    const startListening = () => {
      if (!mounted || thinking || !recognition || !shouldContinueConversation) return;
      speechBuffer = "";
      clearDebounce();
      setAiText("(Speak when ready…)");
      setIsListening(true);
      clearNoSpeech();
      noSpeechTimer = setTimeout(() => {
        if (!mounted || !shouldContinueConversation) return;
        speakAndFinish("Let’s talk again soon.");
      }, 15_000);
      try {
        recognition.start();
      } catch {
        /* already running */
      }
    };

    const speakAndListen = (text: string) => {
      if (!mounted) return;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = speakUtterance(text);
      u.onend = () => {
        if (mounted && shouldContinueConversation) {
          setTimeout(() => {
            if (mounted && shouldContinueConversation) startListening();
          }, 1_200);
        }
      };
      synth.cancel();
      synth.speak(u);
    };

    const speakAndFinish = (text: string) => {
      if (!mounted) return;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = speakUtterance(text);
      u.onend = () => {
        if (mounted) onEndRef.current();
      };
      synth.cancel();
      synth.speak(u);
    };

    const sendToApi = async (finalText: string) => {
      if (!mounted || !shouldContinueConversation || thinking) return;

      if (conversationTurnRef.current >= 10) {
        speakAndFinish(
          "I’ve passed your message to the nurse team. Rest for a bit.",
        );
        return;
      }

      conversationTurnRef.current += 1;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
      thinking = true;
      setIsThinking(true);
      setIsListening(false);
      setAiText(`“${finalText}”…`);

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
        if (mounted) {
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
              要約: data.summary,
              緊急度: data.priority,
            }).catch(() => {});
          }

          if (data.priority >= 4) {
            speakAndFinish(data.response);
          } else {
            speakAndListen(data.response);
          }
        }
      } catch {
        if (mounted) {
          setAiText("Connection issue. One moment…");
          setIsThinking(false);
          thinking = false;
          setTimeout(() => {
            if (mounted && shouldContinueConversation) startListening();
          }, 2000);
        }
      }
    };

    if (recognition) {
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!mounted || !shouldContinueConversation || thinking) return;

        clearNoSpeech();
        noSpeechTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation) return;
          speakAndFinish("Let’s talk again soon.");
        }, 15_000);

        const segment = String(event.results[0][0].transcript ?? "").trim();
        if (!segment) return;

        speechBuffer = speechBuffer ? `${speechBuffer} ${segment}` : segment;
        setAiText(`“${speechBuffer}”`);
        setIsListening(false);

        clearDebounce();
        debounceTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation || thinking) return;

          const finalText = speechBuffer.replace(/\s+/g, " ").trim();
          speechBuffer = "";
          clearDebounce();

          if (finalText.length < 3) {
            startListening();
            return;
          }

          void sendToApi(finalText);
        }, 3_500);
      };

      recognition.onend = () => {
        if (!mounted || !shouldContinueConversation || thinking) return;
        if (debounceTimer) {
          setTimeout(() => {
            if (mounted && shouldContinueConversation && !thinking && debounceTimer) {
              try {
                recognition.start();
              } catch {
                /* ignore */
              }
            }
          }, 80);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed") {
          speakAndListen("Microphone permission is required. Check your browser settings.");
          return;
        }
        if (mounted && !thinking && shouldContinueConversation) {
          setTimeout(() => {
            if (mounted && !thinking && shouldContinueConversation) startListening();
          }, 1_500);
        }
      };
    }

    setTimeout(() => speakAndListen("Kiyoko, what’s going on? Is something wrong?"), 800);

    return () => {
      mounted = false;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      synth.cancel();
      if (recognition) recognition.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { aiText, isListening, isThinking };
}
