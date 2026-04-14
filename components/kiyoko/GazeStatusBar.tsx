"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

type Props = {
  /** trackingError ?? cameraError */
  errorMessage: string | null;
  onRestartCamera: () => void;
  onUsePointerInstead: () => void;
  /** 虹彩: 準備済みだが顔未検出のときだけ */
  faceHint: string | null;
  /** Eyedid などでカメラ待ちのとき */
  showCameraRestartHint: boolean;
};

/**
 * メイン画面用の最小ステータス。詳細な切替・調整は /settings へ。
 */
export function GazeStatusBar({
  errorMessage,
  onRestartCamera,
  onUsePointerInstead,
  faceHint,
  showCameraRestartHint,
}: Props) {
  const hasError = Boolean(errorMessage);

  return (
    <>
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-[10000] flex justify-end p-3 sm:p-4">
        <Link
          href="/settings"
          className="pointer-events-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/75 text-slate-200 shadow-lg backdrop-blur-md transition hover:bg-slate-900/90 hover:text-white"
          aria-label="設定"
        >
          <Settings className="size-6" strokeWidth={1.75} />
        </Link>
      </div>

      {hasError && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[10000] flex justify-center px-3 pt-14 sm:pt-16">
          <div
            role="alert"
            className="pointer-events-auto max-w-lg rounded-2xl border border-red-500/40 bg-red-950/90 px-4 py-3 text-center shadow-xl backdrop-blur-md"
          >
            <p className="text-sm font-semibold text-red-100 sm:text-base">
              {errorMessage}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onRestartCamera}
                className="min-h-[44px] rounded-full border border-red-400/50 bg-red-900/50 px-4 py-2 text-sm text-red-50 transition hover:bg-red-900/80"
              >
                もう一度試す
              </button>
              <button
                type="button"
                onClick={onUsePointerInstead}
                className="min-h-[44px] rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-violet-500"
              >
                タッチで操作
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasError && faceHint && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[9998] flex justify-center px-3 pt-14 sm:pt-16">
          <p className="rounded-full border border-amber-500/25 bg-amber-950/80 px-4 py-2 text-center text-sm font-medium text-amber-100/95 shadow-lg backdrop-blur-md">
            {faceHint}
          </p>
        </div>
      )}

      {!hasError && showCameraRestartHint && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[9998] flex justify-center px-3 pt-14 sm:pt-16">
          <button
            type="button"
            onClick={onRestartCamera}
            className="pointer-events-auto min-h-[44px] rounded-full bg-slate-800/90 px-5 py-2 text-sm text-slate-100 shadow-lg backdrop-blur-md hover:bg-slate-700"
          >
            カメラを再起動
          </button>
        </div>
      )}
    </>
  );
}
