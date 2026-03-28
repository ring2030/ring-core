"use client";

import type { EyedidCalibrationUi } from "@/hooks/useEyedidGaze";

type Props = {
  calUi: EyedidCalibrationUi;
  onSkip: () => void;
};

/**
 * Eyedid SDK の 1〜5 点キャリブレーション中に、
 * 「次に見る位置」と進捗リングを大きく表示します。
 */
export function EyedidCalibrationOverlay({ calUi, onSkip }: Props) {
  const { dot, progress } = calUi;
  const p = Math.min(1, Math.max(0, progress));
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex flex-col items-center px-4 pt-8 pb-4 text-center sm:pt-12">
        <p className="text-2xl font-bold text-white sm:text-3xl">視線の初期調整（1〜5点）</p>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-cyan-200 sm:text-lg">
          画面に出る丸に<strong>視線を合わせて</strong>ください。自動で次の点に進みます。
        </p>
        <p className="mt-2 text-sm text-slate-400">
          カメラの許可が求められたら「許可」を選んでください。
        </p>
      </div>

      {/* SDK が指定する注視点 */}
      {dot != null && (
        <div
          className="pointer-events-none absolute z-[10001] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dot.x, top: dot.y }}
          aria-hidden
        >
          <svg width={120} height={120} viewBox="0 0 120 120" className="drop-shadow-lg">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="rgba(255,255,255,0.1)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p)}
              transform="rotate(-90 60 60)"
            />
            <circle cx="60" cy="60" r="12" fill="white" />
          </svg>
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-4 px-4 pb-8 sm:pb-10">
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-white/25 sm:h-3 sm:w-3"
              style={{
                opacity: p > i / 5 ? 1 : 0.35,
                backgroundColor: p > (i + 1) / 5 ? "rgb(34 211 238)" : undefined,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-slate-400 underline decoration-slate-500 underline-offset-4 hover:text-slate-200"
        >
          スキップ（精度が下がります）
        </button>
      </div>
    </div>
  );
}
