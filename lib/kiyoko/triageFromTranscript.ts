/** 音声認識テキストから緊急度をキーワードで判定（AI自動トリアージ・ルールベース） */

export type VoiceTriage = {
  緊急度: "高" | "低";
  理由: string;
  認識文: string;
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
      緊急度: "低",
      理由: "音声が聞き取れませんでした",
      認識文: "",
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
      緊急度: "高",
      理由: `痛い・転倒・助け（音声）「${short}」`,
      認識文: text,
    };
  }
  if (hitLow) {
    return {
      緊急度: "低",
      理由: `寂しい・呼びたい（音声）「${short}」`,
      認識文: text,
    };
  }

  return {
    緊急度: "低",
    理由: `お話（音声・一般）「${short}」`,
    認識文: text,
  };
}
