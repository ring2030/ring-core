"use client";

import { useEffect, useRef } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { buildCallWritePayload } from "@/lib/calls/schema";
import { REASON_CHAT } from "@/lib/calls/reasons";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { LanternConversation } from "./LanternConversation";

type VoiceTriageModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * "Talk" entry-point modal for the Kiyoko home page.
 *
 * The legacy single-shot "voice → triage → save" flow has been replaced with
 * the bilingual Kiyoko's Lantern conversation: the modal opens a Firestore
 * call record for the nurse dashboard, then hands control to the same
 * lantern-driven session used by the gaze flow. The conversation auto-ends
 * (silence farewell or priority>=4) and calls `onClose`.
 */
export function VoiceTriageModal({ open, onClose }: VoiceTriageModalProps) {
  const currentCallIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<{ role: string; text: string }[]>([]);
  const conversationTurnRef = useRef(0);
  const callOpenedRef = useRef(false);

  // Open the call record once per modal open so the nurse dashboard surfaces a
  // "chat in progress" entry that subsequent /api/chat turns can update.
  useEffect(() => {
    if (!open) {
      callOpenedRef.current = false;
      currentCallIdRef.current = null;
      conversationHistoryRef.current = [];
      conversationTurnRef.current = 0;
      return;
    }
    if (callOpenedRef.current) return;
    callOpenedRef.current = true;
    void (async () => {
      try {
        const docRef = await addDoc(
          collection(getFirestoreDb(), "calls"),
          buildCallWritePayload({
            reasons: [REASON_CHAT],
            note: "AI conversation started (lantern modal)",
            senderName: "Kiyoko",
            senderRole: "patient",
            priority: 2,
          }),
        );
        currentCallIdRef.current = docRef.id;
      } catch (e) {
        console.error("[VoiceTriageModal] save call failed:", e);
      }
    })();
  }, [open]);

  const {
    state,
    aiText,
    lang,
    priority,
    emergencyTrigger,
    ttsSpeaking,
  } = useVoiceConversation({
    active: open,
    currentCallIdRef,
    conversationHistoryRef,
    conversationTurnRef,
    onEnd: onClose,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 motion-safe:animate-[kiyoko-backdrop-in_0.2s_ease-out_both]">
      <LanternConversation
        state={state}
        aiText={aiText}
        lang={lang}
        priority={priority}
        emergencyTrigger={emergencyTrigger}
        ttsSpeaking={ttsSpeaking}
        onEnd={onClose}
      />
    </div>
  );
}
