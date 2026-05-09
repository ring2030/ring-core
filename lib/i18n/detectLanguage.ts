/**
 * Language detection for Kiyoko's Lantern bilingual flow.
 *
 * The patient may speak Japanese or English. The system mirrors whichever
 * language they used: STT, TTS, on-screen typewriter copy, microcopy and the
 * JP/EN badge all derive from the same `ConvLang` value.
 */

export type ConvLang = "ja" | "en";

const CJK_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

/**
 * Returns 'ja' if the text contains any hiragana, katakana, or CJK ideograph;
 * otherwise 'en'. Mixed-language utterances ("お薬 please") classify as 'ja'
 * because the kana presence is the strongest signal that the speaker is
 * Japanese.
 */
export function detectLanguage(text: string): ConvLang {
  return CJK_RE.test(text ?? "") ? "ja" : "en";
}

/** Maps ConvLang to the BCP-47 tag expected by Web Speech / TTS APIs. */
export function toBCP47(lang: ConvLang): "ja-JP" | "en-US" {
  return lang === "ja" ? "ja-JP" : "en-US";
}

/** Locale-friendly UI label for screen readers and badges. */
export function langLabel(lang: ConvLang): "JP" | "EN" {
  return lang === "ja" ? "JP" : "EN";
}
