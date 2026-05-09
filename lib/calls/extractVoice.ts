/**
 * Collect STT / speech text from call documents regardless of field name.
 * Tablets and legacy writers use different keys (`認識文`, `voice`, …).
 */
export function extractVoiceFromRaw(raw: Record<string, unknown>): string {
  const keys = [
    "transcript",
    "認識文",
    "voice",
    "voiceText",
    "speech",
    "utterance",
    "userUtterance",
    "spokenText",
    "stt",
    "recognition",
  ];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
