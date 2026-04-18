"use client";

import { useEffect, useState } from "react";
import type { EyedidCalibrationUi } from "@/hooks/useEyedidGaze";

/** SDK が点を送ってこなくなるまでの待機時間 */
const CALIBRATION_DOT_TIMEOUT_MS = 8_000;

type Props = {
  calUi: EyedidCalibrationUi;
  onSkip: () => void;
  /** カメラ／SDK のエラー（キャリブ中も画面上部に表示） */
  errorText?: string | null;
  /** true のときはまだ Eyedid を起動せず、「カメラを開始」ボタンを出す */
  showCameraGate?: boolean;
  onCameraStart?: () => void;
  /** SDK 再試行（bootstrap を掛け直す） */
  onRetrySdk?: () => void;
  /** 虹彩モードに切り替える（タイムアウト後の誘導ボタン用） */
  onSwitchToIris?: () => void;
};

/**
 * Eyedid SDK の 1〜5 点キャリブレーション中に、
 * 「次に見る位置」と進捗リングを大きく表示します。
 * ブラウザによってはページ読み込み直後の getUserMedia が弾かれるため、
 * 初回は必ずユーザー操作（ボタン）からカメラを開きます。
 */
export function EyedidCalibrationOverlay({
  calUi,
  onSkip,
  errorText,
  showCameraGate = false,
  onCameraStart,
  onRetrySdk,
  onSwitchToIris,
}: Props) {
  const { dot, progress } = calUi;
  const p = Math.min(1, Math.max(0, progress));

  // dot が一度も来ないまま CALIBRATION_DOT_TIMEOUT_MS 経過したらタイムアウトエラーを出す
  const [dotTimedOut, setDotTimedOut] = useState(false);
  const dotEverReceived = dot !== null || progress > 0;

  useEffect(() => {
    if (showCameraGate || dotEverReceived) return;
    const id = setTimeout(() => setDotTimedOut(true), CALIBRATION_DOT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [showCameraGate, dotEverReceived]);
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {errorText ? (
        <div className="z-[10002] border-b border-red-800/80 bg-red-950/95 px-4 py-3 text-center text-sm text-red-100 sm:text-base">
          <p className="font-semibold">⚠️ {errorText}</p>
          {onRetrySdk ? (
            <button
              type="button"
              onClick={onRetrySdk}
              className="mt-2 rounded-full bg-red-900/80 px-4 py-2 text-xs text-red-50 underline-offset-2 hover:bg-red-800 sm:text-sm"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col items-center px-4 pt-8 pb-4 text-center sm:pt-12">
        <p className="text-xl font-bold text-white sm:text-2xl md:text-3xl">Gaze calibration (5 points)</p>

        {showCameraGate ? (
          <>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-cyan-200 sm:text-lg">
              Start by turning on the <strong>camera</strong>. If prompted, choose <strong>Allow</strong>.
            </p>
            <button
              type="button"
              onClick={() => onCameraStart?.()}
              className="mt-10 min-h-[56px] rounded-full bg-cyan-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-cyan-500 active:scale-[0.98] sm:px-10 sm:text-xl"
            >
              Start camera & calibrate
            </button>
            <p className="mt-4 max-w-md text-xs text-slate-500 sm:text-sm">
              Video stays small; it is only used for gaze detection in the background.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-cyan-200 sm:text-lg">
              <strong>Look at</strong> each dot on screen. It advances automatically.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              If the browser asks for camera access, choose Allow.
            </p>
          </>
        )}
      </div>

      {!showCameraGate && dot == null && !dotTimedOut && (
        <div
          className="pointer-events-none absolute inset-0 z-[10000] flex flex-col items-center justify-center gap-4 px-6"
          aria-live="polite"
        >
          <div className="h-16 w-16 animate-pulse rounded-full bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.7)]" />
          <p className="max-w-xl text-center text-base font-bold text-cyan-100 sm:text-lg">
            Loading dot position. Keep your face near the center of the screen.
          </p>
        </div>
      )}

      {!showCameraGate && dot == null && dotTimedOut && (
        <div
          className="absolute inset-0 z-[10000] flex flex-col items-center justify-center gap-6 px-8"
          aria-live="assertive"
        >
          <p className="text-5xl">⚠️</p>
          <p className="max-w-lg text-center text-lg font-bold text-red-300 sm:text-xl">
            Eyedid initialization timed out
          </p>
          <p className="max-w-lg text-center text-sm text-slate-300 sm:text-base">
            License or network may be failing.
            <br />
            If the camera works, continue with <strong className="text-emerald-300">iris mode (MediaPipe)</strong>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {onSwitchToIris && (
              <button
                type="button"
                onClick={onSwitchToIris}
                className="min-h-[52px] rounded-full bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-emerald-500 sm:text-lg"
              >
                Switch to iris mode
              </button>
            )}
            {onRetrySdk && (
              <button
                type="button"
                onClick={() => { setDotTimedOut(false); onRetrySdk(); }}
                className="min-h-[52px] rounded-full border border-slate-500 bg-slate-800 px-6 py-3 text-base text-slate-200 hover:bg-slate-700"
              >
                Retry Eyedid
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200"
          >
            Skip (lower accuracy)
          </button>
        </div>
      )}

      {!showCameraGate && dot != null && (
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
        {!showCameraGate ? (
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
        ) : (
          <div className="h-3" aria-hidden />
        )}
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-slate-400 underline decoration-slate-500 underline-offset-4 hover:text-slate-200"
        >
          Skip (lower accuracy)
        </button>
      </div>
    </div>
  );
}
