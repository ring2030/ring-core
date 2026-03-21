import { useEffect, useRef, useState } from "react";

// ─── 音波合成ヘルパー ──────────────────────────────────────

/**
 * 単一のサイン波を鳴らす。
 * @param ctx  AudioContext
 * @param freq 周波数 (Hz)
 * @param startTime ctx.currentTime からのオフセット (秒)
 * @param duration  音の長さ (秒)
 * @param peakVol   ピーク音量 (0〜1)
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakVol: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  // 短いアタック → 指数的なリリース（ベルらしい余韻）
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakVol, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * おばあちゃん側: 送信成功の「ポーン」
 * C5 (523 Hz) + 薄いオクターブ倍音で温かみを出す
 */
function playPon(ctx: AudioContext) {
  const t = ctx.currentTime;
  playTone(ctx, 523.25, t, 2.2, 0.45);  // C5 — メイン
  playTone(ctx, 1046.5, t, 1.0, 0.10);  // C6 — 倍音（控えめ）
}

/**
 * 看護師側: 新着通知の「ピンポーン」
 * A5 (880 Hz) → E5 (659 Hz) の2音チャイム
 */
function playPingPong(ctx: AudioContext) {
  const t = ctx.currentTime;
  playTone(ctx, 880, t, 0.55, 0.40);        // ピン: A5
  playTone(ctx, 659.25, t + 0.45, 0.80, 0.40); // ポーン: E5
}

// ─── フック ───────────────────────────────────────────────

/**
 * useAudio
 *
 * ブラウザの自動再生制限に対応したサウンドフック。
 * 最初のユーザー操作（click / touchstart）で AudioContext を初期化し、
 * 以降 playSubmitSound / playAlertSound を呼び出せるようになる。
 *
 * @returns {audioReady}       AudioContext が有効か
 * @returns {playSubmitSound}  おばあちゃん側「ポーン」
 * @returns {playAlertSound}   看護師側「ピンポーン」
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const unlock = () => {
      if (ctxRef.current) return;
      ctxRef.current = new AudioContext();
      // Safari 等では suspended 状態で生成されるため resume を呼ぶ
      if (ctxRef.current.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
      setAudioReady(true);
    };

    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playSubmitSound = () => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === "suspended") return;
    playPon(ctx);
  };

  const playAlertSound = () => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === "suspended") return;
    playPingPong(ctx);
  };

  return { audioReady, playSubmitSound, playAlertSound };
}
