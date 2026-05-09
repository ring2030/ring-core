"use client";

import { LanternConversation } from "./LanternConversation";
import type { ConvLang } from "@/lib/i18n/detectLanguage";
import type { LanternState } from "./lantern/Lantern";

type Props = {
  state: LanternState;
  aiText: string;
  lang: ConvLang;
  priority: number;
  emergencyTrigger: number;
  ttsSpeaking: boolean;
  onEnd: () => void;
};

/**
 * Thin compatibility wrapper that mounts the Kiyoko's Lantern conversation
 * surface. Page-level layouts call this after the patient picks "Chat";
 * everything bilingual / volume-reactive lives inside `LanternConversation`.
 */
export function ConversationView(props: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <LanternConversation {...props} />
    </div>
  );
}
