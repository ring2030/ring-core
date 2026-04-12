/** 日本語 TTS 音声を選択し、SpeechSynthesisUtterance を返すヘルパー */

function pickJpVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.name.includes("Nanami") && v.name.includes("Online")) ||
    voices.find((v) => v.lang === "ja-JP" && !v.localService) ||
    voices.find((v) => v.lang === "ja-JP") ||
    null
  );
}

/** 日本語音声を非同期で取得する（voiceschanged 待機対応） */
export function getJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(pickJpVoice(voices));
    } else {
      speechSynthesis.addEventListener(
        "voiceschanged",
        () => resolve(pickJpVoice(speechSynthesis.getVoices())),
        { once: true },
      );
    }
  });
}

/** 日本語設定済みの SpeechSynthesisUtterance を生成する */
export async function makeJapaneseUtterance(text: string): Promise<SpeechSynthesisUtterance> {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.9;
  u.pitch = 1.1;
  u.voice = await getJapaneseVoice();
  return u;
}
