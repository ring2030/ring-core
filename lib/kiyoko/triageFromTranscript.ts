/** Rule-based triage from speech transcript (Japanese keyword matching). */

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

  const highKeywords = [
    "痛い",
    "転んだ",
    "たおれた",
    "倒れた",
    "助けて",
    "たすけて",
  ];
  const lowKeywords = [
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

  const hitHigh = highKeywords.some((k) => text.includes(k));
  const hitLow = lowKeywords.some((k) => text.includes(k));

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
