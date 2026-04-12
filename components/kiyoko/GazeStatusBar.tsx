"use client";

import type { NurseInputMode } from "@/lib/gaze/inputModeStorage";
import { trackingLabel } from "@/lib/gaze/trackingLabel";

type Props = {
  inputMode: NurseInputMode;
  onInputModeChange: (mode: NurseInputMode) => void;
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
  inputMode,
  onInputModeChange,
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
  const isPointer = inputMode === "pointer";

  return (
    <>
      {/* 入力モード：視線 SDK が死んでいてもナースコールは成立させる */}
      <div className="absolute top-4 left-1/2 z-[10000] flex w-[min(100%,28rem)] -translate-x-1/2 flex-col gap-3 px-3">
        <div
          className="flex rounded-2xl border border-slate-600/80 bg-slate-950/90 p-1 shadow-lg backdrop-blur-md"
          role="tablist"
          aria-label="入力のしかた"
        >
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === "eyedid"}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition sm:text-base ${
              inputMode === "eyedid"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => onInputModeChange("eyedid")}
          >
            視線
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === "pointer"}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition sm:text-base ${
              inputMode === "pointer"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => onInputModeChange("pointer")}
          >
            タッチ・マウス
          </button>
        </div>

        <p
          className={`text-center text-base font-bold sm:text-xl ${
            hasError ? "text-red-300" : "text-slate-200"
          }`}
        >
          {hasError ? `⚠️ ${trackingError ?? cameraError}` : statusMessage}
        </p>

        {!hasError && isPointer && (
          <p className="text-center text-xs text-violet-300/90 sm:text-sm">
            指やマウスを動かしてタイルの上で止めると、同じように確定します。
          </p>
        )}

        {!hasError && !isPointer && (
          <p className="text-center text-xs text-slate-500 sm:text-sm">
            視線が不安定なときは「タッチ・マウス」に切り替えてください。
          </p>
        )}

        {!isPointer && (
          <p className="text-center font-mono text-[10px] text-slate-500 sm:text-xs">
            視線状態: {trackingLabel(trackingState)}
            {trackingState === 3
              ? " — 正面を向き、明るさを上げてください。"
              : gazePointX < 0
                ? " — まだ視線を取得できていません。"
                : ""}
          </p>
        )}

        {hasError && !isPointer && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onRestartCamera}
              className="min-h-[44px] rounded-full border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
            >
              カメラを再試行
            </button>
            <button
              type="button"
              onClick={() => onInputModeChange("pointer")}
              className="min-h-[44px] rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-violet-500"
            >
              タッチ・マウスで続行
            </button>
          </div>
        )}

        {!hasError && statusMessage === "カメラを準備しています..." && !isPointer && (
          <button
            type="button"
            onClick={onRestartCamera}
            className="mx-auto min-h-[44px] rounded-full bg-slate-700 px-5 py-2 text-sm text-slate-200 hover:bg-slate-600"
          >
            📷 カメラを再起動
          </button>
        )}
      </div>

      {!isPointer && (
        <>
          <button
            type="button"
            onClick={onRecalibrate}
            className="absolute top-4 right-4 z-[10000] min-h-[40px] rounded-full border border-slate-600/80 bg-slate-900/85 px-3 py-2 text-xs text-slate-300 shadow backdrop-blur-sm hover:bg-slate-800"
          >
            再調整
          </button>

          <button
            type="button"
            onClick={onToggleTuning}
            className="absolute top-4 left-4 z-[10000] min-h-[40px] rounded-full border border-slate-600/80 bg-slate-900/85 px-3 py-2 text-xs text-slate-300 shadow backdrop-blur-sm hover:bg-slate-800"
            aria-pressed={showTuning}
          >
            感度
          </button>

          <div className="absolute left-4 top-[4.5rem] z-[10000] flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">カメラ</span>
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
        </>
      )}
    </>
  );
}
