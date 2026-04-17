/** Canonical English labels for gaze targets and primary call reasons */
export const REASON_RESTROOM = "Restroom" as const;
export const REASON_CHAT = "Chat" as const;

export type BinaryGazeReason = typeof REASON_RESTROOM | typeof REASON_CHAT;

/**
 * Maps legacy Japanese (and mixed) strings stored in Firestore to English for UI.
 */
export const LEGACY_REASON_TO_EN: Record<string, string> = {
  トイレ: REASON_RESTROOM,
  お話: REASON_CHAT,
  "トイレ（急ぎ）": "Urgent restroom",
  痛い: "Pain",
  寂しい: "Lonely",
  水が欲しい: "Wants water",
  薬が欲しい: "Wants medication",
  胸が痛い: "Chest pain",
  転んだ: "Fallen",
  眠れない: "Can't sleep",
  不安: "Anxious",
  助けて: "Help",
  気分が悪い: "Unwell",
  めまいがする: "Dizzy",
  お腹が空いた: "Hungry",
  寒い: "Cold",
  体位を変えて: "Reposition",
  その他: "Other",
  お水・お茶: "Water / tea",
  "痛い・苦しい": "Pain / distress",
  "不安・さみしい": "Anxiety / loneliness",
  必要なし: "None needed",
  排泄の介助: "Toileting assistance",
  "傾聴・お話し相手": "Listening / conversation",
  "不安・孤独感の緩和": "Easing anxiety / loneliness",
  "水分・食事サポート": "Hydration / meal support",
  "痛み・体調管理": "Pain / condition care",
};

export function normalizeReasonLabel(reason: string): string {
  const t = reason.trim();
  return LEGACY_REASON_TO_EN[t] ?? t;
}

export function normalizeReasonList(reasons: string[]): string[] {
  return reasons.map((r) => normalizeReasonLabel(r));
}

const EMOJI_BY_LABEL: Record<string, string> = {
  [REASON_RESTROOM]: "🚽",
  [REASON_CHAT]: "💬",
  "Urgent restroom": "🚽",
  Pain: "🚨",
  Lonely: "🤝",
  "Wants water": "💧",
  "Wants medication": "💊",
  "Chest pain": "🚨",
  Fallen: "⚠️",
  "Can't sleep": "🌙",
  Anxious: "🫂",
  Help: "🚨",
  Unwell: "😔",
  Dizzy: "💫",
  Hungry: "🍚",
  Cold: "🥶",
  Reposition: "🛏️",
  Other: "📋",
  "Water / tea": "💧",
  "Pain / distress": "🚨",
  "Anxiety / loneliness": "🤝",
  "None needed": "✓",
  "Listening / conversation": "💬",
  "Easing anxiety / loneliness": "🤝",
  "Hydration / meal support": "💧",
  "Pain / condition care": "🚨",
  "Toileting assistance": "🚽",
};

/** Emoji for a reason after normalization (falls back to neutral). */
export function emojiForReason(reason: string): string {
  const n = normalizeReasonLabel(reason);
  return EMOJI_BY_LABEL[n] ?? EMOJI_BY_LABEL[reason] ?? "•";
}
