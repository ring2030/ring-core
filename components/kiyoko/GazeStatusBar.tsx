"use client";

import { trackingLabel } from "@/lib/gaze/trackingLabel";

type Props = {
  statusMessage: string;
  trackingError: string | null;
  cameraError: string | null;
  trackingState: number | null;
  gazePointX: number;
  onRestartCamera: () => void;
  onRecalibrate: () => void;
  onCameraPlacement: (cameraOnTop: boolean) => void;
  showTuning: boolean;
  onToggleTuning: () => void;
};

export function GazeStatusBar({
  statusMessage,
  trackingError,
  cameraError,
  trackingState,
  gazePointX,
  onRestartCamera,
  onRecalibrate,
  onCameraPlacement,
  showTuning,
  onToggleTuning,
}: Props) {
  const hasError = Boolean(trackingError || cameraError);

  return (
    <>
      <div className="text-center absolute top-8 z-[10000] flex max-w-[min(100%,42rem)] flex-col items-center gap-3 px-4">
        <p
          className={`text-lg font-bold inline-block px-6 py-3 rounded-full shadow-md border-2 sm:text-2xl sm:px-8 ${
            hasError
              ? "bg-red-900/90 text-red-300 border-red-700"
              : "bg-slate-800/90 text-slate-400 border-slate-700"
          }`}
        >
          {hasError ? `⚠️ ${trackingError ?? cameraError}` : statusMessage}
        </p>
        {!hasError && (
          <p className="text-xs text-slate-500 sm:text-sm">
            赤い点の較正をやり直す → 右上「再キャリブレーション」（保存済みだとメイン画面では赤い点は出ません）
          </p>
        )}
        {!trackingError && (
          <p className="font-mono text-[10px] text-slate-500 sm:text-xs">
            視線状態: {trackingLabel(trackingState)}
            {trackingState === 3
              ? " — 画面を正面から見て、明るさを上げてください。"
              : gazePointX < 0
                ? " — 視線がまだ取得できていません。"
                : ""}
          </p>
        )}
        {(hasError || statusMessage === "カメラを準備しています...") && (
          <button
            type="button"
            onClick={onRestartCamera}
            className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2 rounded-full border border-slate-500 transition touch-manipulation min-h-[44px]"
          >
            📷 カメラを再起動
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onRecalibrate}
        className="absolute top-8 right-8 z-[10000] text-xs text-slate-400 bg-slate-800/70 border border-slate-700 px-3 py-2 rounded-full shadow touch-manipulation min-h-[40px]"
      >
        再キャリブレーション
      </button>

      <button
        type="button"
        onClick={onToggleTuning}
        className="absolute top-8 left-8 z-[10000] text-xs text-slate-400 bg-slate-800/70 border border-slate-700 px-3 py-2 rounded-full shadow touch-manipulation min-h-[40px]"
        aria-pressed={showTuning}
      >
        視線チューニング
      </button>

      {!trackingError && (
        <div className="absolute left-8 top-24 z-[10000] flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500">カメラがモニタの</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onCameraPlacement(true)}
              className="rounded-lg border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-[11px] text-cyan-200 hover:bg-slate-700"
            >
              上
            </button>
            <button
              type="button"
              onClick={() => onCameraPlacement(false)}
              className="rounded-lg border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-[11px] text-cyan-200 hover:bg-slate-700"
            >
              下
            </button>
          </div>
        </div>
      )}
    </>
  );
}
