"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import { TuningPanel } from "@/components/kiyoko/TuningPanel";
import { setEyedidCameraOnTop, getEyedidCameraOnTop } from "@/lib/gaze/eyedidCameraPlacementStorage";
import { getStoredGazeEngine, setStoredGazeEngine, type StoredGazeEngine } from "@/lib/gaze/gazeEngineStorage";
import {
  loadGazeTuning,
  normalizeGazeTuning,
  saveGazeTuning,
  type GazeTuning,
} from "@/lib/gaze/tuning";
import {
  getStoredInputMode,
  setStoredInputMode,
  type NurseInputMode,
} from "@/lib/gaze/inputModeStorage";
import {
  getStoredIrisCameraId,
  setStoredIrisCameraId,
} from "@/lib/gaze/irisCameraStorage";

export default function SettingsPage() {
  const [inputMode, setInputMode] = useState<NurseInputMode>(() => getStoredInputMode());
  const [gazeEngine, setGazeEngine] = useState<StoredGazeEngine>(() => getStoredGazeEngine());
  const [gazeTuning, setGazeTuning] = useState<GazeTuning>(() => loadGazeTuning());
  const [eyedidCamTop, setEyedidCamTop] = useState<boolean | null>(() => getEyedidCameraOnTop());
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [irisCamId, setIrisCamId] = useState<string | undefined>(() => getStoredIrisCameraId());
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    saveGazeTuning(gazeTuning);
  }, [gazeTuning]);

  const refreshDevices = useCallback(async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setVideoInputs(list.filter((d) => d.kind === "videoinput"));
    } catch {
      setMediaError("カメラ一覧を取得できませんでした。ブラウザでカメラを許可してください。");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((list) => {
        if (cancelled) return;
        setVideoInputs(list.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        if (cancelled) return;
        setMediaError("カメラ一覧を取得できませんでした。ブラウザでカメラを許可してください。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyInputMode = (mode: NurseInputMode) => {
    setStoredInputMode(mode);
    setInputMode(mode);
  };

  const applyEngine = (engine: StoredGazeEngine) => {
    setStoredGazeEngine(engine);
    setGazeEngine(engine);
  };

  const applyEyedidPlacement = (onTop: boolean) => {
    setEyedidCameraOnTop(onTop);
    setEyedidCamTop(onTop);
  };

  const applyIrisCamera = (id: string) => {
    setStoredIrisCameraId(id);
    setIrisCamId(id);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
              ホームへ
            </Link>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
            設定
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">操作のしかた</h2>
          <p className="mt-1 text-sm text-slate-600">
            ホーム画面では次の設定が使われます。
          </p>
          <div
            className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1"
            role="tablist"
            aria-label="入力のしかた"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "eyedid"}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition sm:text-base ${
                inputMode === "eyedid"
                  ? "bg-white text-cyan-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => applyInputMode("eyedid")}
            >
              視線
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "pointer"}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition sm:text-base ${
                inputMode === "pointer"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => applyInputMode("pointer")}
            >
              タッチ・マウス
            </button>
          </div>
        </section>

        {inputMode === "eyedid" && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-bold text-slate-900">視線エンジン</h2>
            <p className="mt-1 text-sm text-slate-600">
              通常は「虹彩」で問題ありません。Eyedid は別ライセンスが必要な場合があります。
            </p>
            <div className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                  gazeEngine === "iris"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => applyEngine("iris")}
              >
                虹彩
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                  gazeEngine === "eyedid"
                    ? "bg-white text-cyan-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => applyEngine("eyedid")}
              >
                Eyedid
              </button>
            </div>

            {gazeEngine === "iris" && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-sm font-bold text-slate-800">カメラ（虹彩）</h3>
                <p className="mt-1 text-xs text-slate-500">
                  複数台あるときだけ選んでください。
                </p>
                {mediaError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {mediaError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshDevices()}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    一覧を更新
                  </button>
                </div>
                <ul className="mt-3 space-y-2">
                  {videoInputs.map((d) => (
                    <li key={d.deviceId}>
                      <button
                        type="button"
                        onClick={() => applyIrisCamera(d.deviceId)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          irisCamId === d.deviceId ||
                          (!irisCamId && videoInputs[0]?.deviceId === d.deviceId)
                            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {d.label || `カメラ ${d.deviceId.slice(0, 8)}…`}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gazeEngine === "eyedid" && (
              <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">カメラの位置（Eyedid）</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    内蔵カメラがモニタの上か下かに合わせます。ホームに戻ると反映されます。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyEyedidPlacement(true)}
                      className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
                        eyedidCamTop === true
                          ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      モニタの上
                    </button>
                    <button
                      type="button"
                      onClick={() => applyEyedidPlacement(false)}
                      className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
                        eyedidCamTop === false
                          ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      モニタの下
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">視線の再調整</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Eyedid のキャリブレーションをやり直します。
                  </p>
                  <Link
                    href="/?recalibrate=1"
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-700"
                  >
                    再調整をホームで開く
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {(inputMode === "pointer" ||
          (inputMode === "eyedid" && gazeEngine === "eyedid")) && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-0 shadow-sm sm:p-0">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold text-slate-900">左右の感度</h2>
              <p className="mt-1 text-sm text-slate-600">
                トイレとお話の判定幅です。虹彩モードでは使いません。
              </p>
            </div>
            <div className="p-5 sm:p-6">
              <TuningPanel
                embedded
                gazeTuning={gazeTuning}
                onTuningChange={(t) => setGazeTuning(normalizeGazeTuning(t))}
                onClose={() => {}}
              />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">スタッフ・家族</h2>
          <p className="mt-1 text-sm text-slate-600">
            記録やナース向け画面はこちらから開けます。
          </p>
          <div className="mt-4">
            <StaffLinks className="gap-2" />
          </div>
        </section>

        <p className="pb-8 text-center text-xs text-slate-500">
          <Link href="/" className="inline-flex items-center gap-1 font-medium text-cyan-700 hover:underline">
            <Home className="size-3.5" aria-hidden />
            きよ子のホームへ
          </Link>
        </p>
      </main>
    </div>
  );
}
