/** Rule-based triage from speech (English + legacy Japanese keyword matching). */

export type VoiceTriage = {
  urgency: "high" | "low";
  reason: string;
  transcript: string;
};

function clip(s: string, max = 100) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function triageFromTranscript(raw: string): VoiceTriage {
  const text = raw.trim();
  if (!text) {
    return {
      urgency: "low",
      reason: "No speech captured",
      transcript: "",
    };
  }

  const lower = text.toLowerCase();

  const highKeywordsJa = [
    "痛い",
    "転んだ",
    "たおれた",
    "倒れた",
    "助けて",
    "たすけて",
  ];
  const highKeywordsEn = [
    "hurt",
    "pain",
    "painful",
    "fell",
    "fall",
    "fallen",
    "help",
    "emergency",
    "can't breathe",
    "cannot breathe",
    "bleeding",
    "chest pain",
    "dizzy",
  ];

  const lowKeywordsJa = [
    "寂しい",
    "さみしい",
    "さびしい",
    "淋しい",
    "呼びたい",
    "よびたい",
    "話したい",
    "はなしたい",
    "聞きたい",
  ];
  const lowKeywordsEn = [
    "lonely",
    "loneliness",
    "feel alone",
    "so alone",
    "scared",
    "afraid",
    "need company",
    "want company",
    "want to talk",
    "miss you",
  ];

  const hitHigh =
    highKeywordsJa.some((k) => text.includes(k)) ||
    highKeywordsEn.some((k) => lower.includes(k));
  const hitLow =
    lowKeywordsJa.some((k) => text.includes(k)) ||
    lowKeywordsEn.some((k) => lower.includes(k));

  const short = clip(text);

  if (hitHigh) {
    return {
      urgency: "high",
      reason: `Voice — pain / fall / help (“${short}”)`,
      transcript: text,
    };
  }
  if (hitLow) {
    return {
      urgency: "low",
      reason: `Voice — lonely / wants company (“${short}”)`,
      transcript: text,
    };
  }

  return {
    urgency: "low",
    reason: `Voice — general (“${short}”)`,
    transcript: text,
  };
}
