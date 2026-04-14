"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { makeJapaneseUtterance } from "@/lib/voice/japaneseVoice";
import type { TriageResponse } from "@/app/api/chat/route";

export type UseVoiceConversationParams = {
  /** true のとき会話セッションを開始・維持する */
  active: boolean;
  currentCallIdRef: React.MutableRefObject<string | null>;
  conversationHistoryRef: React.MutableRefObject<{ role: string; text: string }[]>;
  conversationTurnRef: React.MutableRefObject<number>;
  /** 会話が完全に終了したとき（TTS 完了後）に呼ばれる */
  onEnd: () => void;
};

export type UseVoiceConversationResult = {
  aiText: string;
  isListening: boolean;
  isThinking: boolean;
};

/**
 * Gemini 音声会話セッション。
 * active=true になると Web Speech API でマイクを起動し、発話をデバウンスして
 * /api/chat に送る。会話が終了したら onEnd() を呼ぶ。
 */
export function useVoiceConversation({
  active,
  currentCallIdRef,
  conversationHistoryRef,
  conversationTurnRef,
  onEnd,
}: UseVoiceConversationParams): UseVoiceConversationResult {
  const [aiText, setAiText] = useState("お話し相手を呼んでいます...");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });

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
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    };
    const clearNoSpeech = () => {
      if (noSpeechTimer) { clearTimeout(noSpeechTimer); noSpeechTimer = null; }
    };

    const startListening = () => {
      if (!mounted || thinking || !recognition || !shouldContinueConversation) return;
      speechBuffer = "";
      clearDebounce();
      setAiText("（話しかけてください...）");
      setIsListening(true);
      clearNoSpeech();
      noSpeechTimer = setTimeout(() => {
        if (!mounted || !shouldContinueConversation) return;
        speakAndFinish("またお話ししましょうね。");
      }, 15_000);
      try { recognition.start(); } catch { /* 既に起動中は無視 */ }
    };

    const speakAndListen = async (text: string) => {
      if (!mounted) return;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = await makeJapaneseUtterance(text);
      u.onend = () => {
        if (mounted && shouldContinueConversation) {
          setTimeout(() => { if (mounted && shouldContinueConversation) startListening(); }, 1_200);
        }
      };
      synth.cancel();
      synth.speak(u);
    };

    const speakAndFinish = async (text: string) => {
      if (!mounted) return;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      speechBuffer = "";
      if (recognition) { try { recognition.stop(); } catch {} }
      setAiText(text);
      setIsListening(false);
      setIsThinking(false);
      thinking = false;

      const u = await makeJapaneseUtterance(text);
      u.onend = () => { if (mounted) onEndRef.current(); };
      synth.cancel();
      synth.speak(u);
    };

    const sendToApi = async (finalText: string) => {
      if (!mounted || !shouldContinueConversation || thinking) return;

      if (conversationTurnRef.current >= 10) {
        speakAndFinish("きよ子さんのお話、看護師さんへしっかり伝えました。ゆっくり休んでくださいね。");
        return;
      }

      conversationTurnRef.current += 1;
      if (recognition) { try { recognition.stop(); } catch {} }
      thinking = true;
      setIsThinking(true);
      setIsListening(false);
      setAiText(`「${finalText}」...`);

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
          setAiText("通信に問題があります。少し待ってみてください。");
          setIsThinking(false);
          thinking = false;
          setTimeout(() => { if (mounted && shouldContinueConversation) startListening(); }, 2000);
        }
      }
    };

    if (recognition) {
      recognition.lang = "ja-JP";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!mounted || !shouldContinueConversation || thinking) return;

        clearNoSpeech();
        noSpeechTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation) return;
          speakAndFinish("またお話ししましょうね。");
        }, 15_000);

        const segment = String(event.results[0][0].transcript ?? "").trim();
        if (!segment) return;

        speechBuffer = (speechBuffer ? speechBuffer + "　" + segment : segment);
        setAiText(`「${speechBuffer}」`);
        setIsListening(false);

        clearDebounce();
        debounceTimer = setTimeout(() => {
          if (!mounted || !shouldContinueConversation || thinking) return;

          const finalText = speechBuffer.replace(/\s+/g, "");
          speechBuffer = "";
          clearDebounce();

          if (finalText.length < 3) {
            startListening();
            return;
          }

          sendToApi(finalText);
        }, 3_500);
      };

      recognition.onend = () => {
        if (!mounted || !shouldContinueConversation || thinking) return;
        if (debounceTimer) {
          setTimeout(() => {
            if (mounted && shouldContinueConversation && !thinking && debounceTimer) {
              try { recognition.start(); } catch {}
            }
          }, 80);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed") {
          speakAndListen("マイクの許可が必要です。ブラウザの設定をご確認ください。");
          return;
        }
        if (mounted && !thinking && shouldContinueConversation) {
          setTimeout(() => {
            if (mounted && !thinking && shouldContinueConversation) startListening();
          }, 1_500);
        }
      };
    }

    setTimeout(() => speakAndListen("きよ子さん、どうしました？何かありましたか？"), 800);

    return () => {
      mounted = false;
      shouldContinueConversation = false;
      clearNoSpeech();
      clearDebounce();
      synth.cancel();
      if (recognition) recognition.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]); // refs are stable objects; only `active` meaningfully changes

  return { aiText, isListening, isThinking };
}
