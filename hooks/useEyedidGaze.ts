"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEyedidLicenseKey } from "@/lib/gaze/eyedidLicense";
import {
  CAL_TS_KEY,
  EYEDID_CAL_KEY,
  EYEDID_CAL_TTL_MS,
} from "@/lib/gaze/eyedidStorage";
import { describeEyedidInitError } from "@/lib/gaze/eyedidInitMessage";
import { getEyedidCameraOnTop } from "@/lib/gaze/eyedidCameraPlacementStorage";
import { GAZE_THROTTLE_MS } from "@/lib/constants";
import type EasySeeSo from "seeso/easy-seeso";

/** easy-seeso 内部の seeso インスタンスへアクセスし、errCode を取得するための型 */
type EasySeeSoInternal = EasySeeSo & {
  seeso: {
    initialize: (licenseKey: string, opt: unknown) => Promise<number>;
    addCalibrationFinishCallback: (fn: unknown) => void;
    addGazeCallback: (fn: unknown) => void;
  };
  onCalibrationFinished_: (calibrationData: string) => void;
  onGaze_: (gazeInfo: unknown) => void;
  onCalibrationFinishedBind: unknown;
  onGazeBind: unknown;
};

export type EyedidCalibrationUi = {
  /** SDK が指示する次の注視点（ブラウザ座標系） */
  dot: { x: number; y: number } | null;
  /** 0〜1 の進捗（SDK のキャリブレーション進行状況） */
  progress: number;
};

export type UseEyedidGazeParams = {
  /** 省電力モード中はカメラトラッキングを停止する */
  isSleepMode: boolean;
  /** キャリブレーション UI を表示すべきとき true（初回 or 再教育） */
  isCalibrating: boolean;
  /** カメラ・SDK を最初からやり直すたびに増やす */
  bootstrapVersion: number;
  /** 視線座標（画面ピクセル） */
  onGazePoint: (x: number, y: number) => void;
  /** 視線が来たときにスリープタイマーをリセットする */
  onGazeActivity: () => void;
  /** ステータス文言（例: 「視線を検知中…」） */
  onStatusMessage: (msg: string) => void;
  /** キャリブレーション完了時（データ保存済み） */
  onCalibrationComplete: () => void;
  /**
   * false の間は SDK を起動しない。
   * 初回キャリブ前はユーザー操作（ボタン）後に true にし、getUserMedia を確実に許可させる。
   */
  enabled?: boolean;
};

export type UseEyedidGazeResult = {
  licenseError: string | null;
  initError: string | null;
  /** まばたきが検出された回数（デバッグ用・累計） */
  blinkCount: number;
  /** 直近の集中度スコア（SDK 値。未受信時は null） */
  attentionScore: number | null;
  /** TrackingState の生値（0=SUCCESS, 1=LOW_CONF, 3=FACE_MISSING など） */
  trackingState: number | null;
  calUi: EyedidCalibrationUi;
  /** キャリブレーションを中断（精度は下がります） */
  skipCalibration: () => void;
  /** 内蔵カメラがモニタの上か下か（顔検出が出ないときの切り分け用） */
  setCameraPlacement: (cameraOnTop: boolean) => void;
};

/**
 * Eyedid Web SDK（npm: seeso）で視線・まばたき・集中度を扱うフック。
 * クライアント専用。サーバーでは何もしません。
 */
export function useEyedidGaze({
  isSleepMode,
  isCalibrating,
  bootstrapVersion,
  onGazePoint,
  onGazeActivity,
  onStatusMessage,
  onCalibrationComplete,
  enabled = true,
}: UseEyedidGazeParams): UseEyedidGazeResult {
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [attentionScore, setAttentionScore] = useState<number | null>(null);
  const [trackingState, setTrackingState] = useState<number | null>(null);
  const [calUi, setCalUi] = useState<EyedidCalibrationUi>({
    dot: null,
    progress: 0,
  });

  const easyRef = useRef<EasySeeSo | null>(null);
  const trackingActiveRef = useRef(false);
  const lastGazeAtRef = useRef(0);
  const calibratingRef = useRef(isCalibrating);
  calibratingRef.current = isCalibrating;

  const onGazePointRef = useRef(onGazePoint);
  onGazePointRef.current = onGazePoint;
  const onGazeActivityRef = useRef(onGazeActivity);
  onGazeActivityRef.current = onGazeActivity;
  const onStatusMessageRef = useRef(onStatusMessage);
  onStatusMessageRef.current = onStatusMessage;
  const onCalibrationCompleteRef = useRef(onCalibrationComplete);
  onCalibrationCompleteRef.current = onCalibrationComplete;

  const skipCalibration = useCallback(() => {
    const easy = easyRef.current;
    try {
      easy?.stopCalibration();
    } catch {
      /* ignore */
    }
    setCalUi({ dot: null, progress: 0 });
    onCalibrationCompleteRef.current();
  }, []);

  const setCameraPlacement = useCallback((cameraOnTop: boolean) => {
    const easy = easyRef.current as
      | (EasySeeSo & { setCameraPosition: (cameraX: number, cameraOnTop: boolean) => void })
      | null;
    if (!easy) return;
    try {
      const x = typeof window !== "undefined" ? Math.floor(window.innerWidth / 2) : 0;
      easy.setCameraPosition(x, cameraOnTop);
      onStatusMessageRef.current(
        `カメラを「モニタ${cameraOnTop ? "上" : "下"}」前提にしました（まだ反応しない場合は再キャリブ）`,
      );
    } catch (e) {
      console.error("[Eyedid] setCameraPosition", e);
    }
  }, []);

  // ── メインの初期化・トラッキング・キャリブレーション ─────────────
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLicenseError(null);
      setInitError(null);
      setTrackingState(null);

      const license = getEyedidLicenseKey();
      if (!license) {
        setLicenseError(
          "Eyedid のライセンスキーが未設定です。.env.local に NEXT_PUBLIC_EYEDID_LICENSE_KEY を設定してください。",
        );
        onStatusMessageRef.current("ライセンス未設定");
        return;
      }

      let EasySeeSoCtor: typeof import("seeso/easy-seeso").default;
      let TrackingState: typeof import("seeso").TrackingState;
      let UserStatusOption: typeof import("seeso").UserStatusOption;
      let InitializationErrorType: typeof import("seeso").InitializationErrorType;

      try {
        const [easyMod, seesoMod] = await Promise.all([
          import("seeso/easy-seeso"),
          import("seeso"),
        ]);
        if (cancelled) return;
        EasySeeSoCtor = easyMod.default;
        TrackingState = seesoMod.TrackingState;
        UserStatusOption = seesoMod.UserStatusOption;
        InitializationErrorType = seesoMod.InitializationErrorType;
      } catch (e) {
        console.error("[Eyedid] SDK の読み込みに失敗しました", e);
        if (!cancelled) {
          setInitError("視線 SDK の読み込みに失敗しました。ページを再読み込みしてください。");
        }
        return;
      }

      const easy = new EasySeeSoCtor();
      easyRef.current = easy;
      const ez = easy as unknown as EasySeeSoInternal;

      const userOpt = new UserStatusOption(true, true, false);
      let errCode: number;
      try {
        errCode = await ez.seeso.initialize(license, userOpt);
      } catch (e) {
        console.error("[Eyedid] initialize が例外を投げました", e);
        if (!cancelled) {
          setInitError(
            "Eyedid SDK の初期化処理で通信エラーが発生しました。ネットワークを確認してください。",
          );
          onStatusMessageRef.current("初期化エラー");
        }
        return;
      }

      if (errCode !== InitializationErrorType.ERROR_NONE) {
        console.warn("[Eyedid] initialize errCode =", errCode);
        if (!cancelled) {
          setInitError(describeEyedidInitError(errCode));
          onStatusMessageRef.current("初期化エラー");
        }
        return;
      }

      ez.onCalibrationFinishedBind = ez.onCalibrationFinished_.bind(easy);
      ez.seeso.addCalibrationFinishCallback(ez.onCalibrationFinishedBind);
      ez.onGazeBind = ez.onGaze_.bind(easy);
      ez.seeso.addGazeCallback(ez.onGazeBind);

      if (cancelled) return;

      easy.setUserStatusCallback(
        (_tb, _te, score) => {
          if (!cancelled) setAttentionScore(score);
        },
        (_tb, _te, isBlink) => {
          if (isBlink && !cancelled) setBlinkCount((c) => c + 1);
        },
        () => {},
      );

      /** SUCCESS だけでなく LOW_CONFIDENCE も採用（実機では後者の方が多い） */
      const isUsableTracking = (ts: number) =>
        ts === TrackingState.SUCCESS || ts === TrackingState.LOW_CONFIDENCE;

      const runGaze = (gazeInfo: {
        x: number;
        y: number;
        trackingState: number;
      }) => {
        if (!cancelled) setTrackingState(gazeInfo.trackingState);
        if (!isUsableTracking(gazeInfo.trackingState)) return;
        if (!Number.isFinite(gazeInfo.x) || !Number.isFinite(gazeInfo.y)) return;
        const now = Date.now();
        if (now - lastGazeAtRef.current < GAZE_THROTTLE_MS) return;
        lastGazeAtRef.current = now;
        onGazePointRef.current(gazeInfo.x, gazeInfo.y);
        onGazeActivityRef.current();
        onStatusMessageRef.current("視線を検知中...");
      };

      try {
        const ok = await easy.startTracking(runGaze, () => {});
        if (!ok) {
          if (!cancelled) {
            setInitError("視線トラッキングを開始できませんでした。");
          }
          return;
        }
        trackingActiveRef.current = true;
        const placed = getEyedidCameraOnTop();
        if (placed !== null && !cancelled) {
          try {
            const x = typeof window !== "undefined" ? Math.floor(window.innerWidth / 2) : 0;
            (
              easy as unknown as {
                setCameraPosition: (cameraX: number, cameraOnTop: boolean) => void;
              }
            ).setCameraPosition(x, placed);
          } catch (e) {
            console.error("[Eyedid] setCameraPosition (stored preference)", e);
          }
        }
      } catch (e: unknown) {
        const name = e instanceof Error ? e.name : "";
        const msg =
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "カメラの使用が拒否されました。ブラウザのアドレスバー横の設定でカメラを許可してください。"
            : "カメラを起動できませんでした。接続と権限を確認してください。";
        if (!cancelled) setInitError(msg);
        console.error("[Eyedid] getUserMedia / startTracking", e);
        return;
      }
      if (cancelled) return;

      const cached = typeof localStorage !== "undefined"
        ? localStorage.getItem(EYEDID_CAL_KEY)
        : null;
      const tsRaw = typeof localStorage !== "undefined"
        ? localStorage.getItem(CAL_TS_KEY)
        : null;
      const fresh =
        tsRaw != null &&
        !Number.isNaN(parseInt(tsRaw, 10)) &&
        Date.now() - parseInt(tsRaw, 10) < EYEDID_CAL_TTL_MS;

      const needCalibration = calibratingRef.current;

      if (cached && fresh && !needCalibration) {
        try {
          await easy.setCalibrationData(cached);
        } catch (e) {
          console.error("[Eyedid] setCalibrationData (cache)", e);
        }
        if (!cancelled) {
          // キャッシュ適用後も「準備」のままだと誤解されやすい。視線コールバックまでの案内に切り替える
          onStatusMessageRef.current("視線を検知中...");
          onCalibrationCompleteRef.current();
        }
        return;
      }

      onStatusMessageRef.current("視線を準備しています...");

      // 1〜5 点キャリブレーション（SDK 組み込み）
      setCalUi({ dot: null, progress: 0 });
      const started = easy.startCalibration(
        (bx, by) => {
          if (!cancelled) setCalUi((u) => ({ ...u, dot: { x: bx, y: by } }));
        },
        (p) => {
          if (!cancelled) {
            const n = typeof p === "number" && Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
            setCalUi((u) => ({ ...u, progress: n }));
          }
        },
        async (dataStr: string) => {
          try {
            await easy.setCalibrationData(dataStr);
          } catch (e) {
            console.error("[Eyedid] setCalibrationData (new)", e);
          }
          try {
            localStorage.setItem(EYEDID_CAL_KEY, dataStr);
            localStorage.setItem(CAL_TS_KEY, String(Date.now()));
          } catch {
            /* private mode 等 */
          }
          if (!cancelled) {
            setCalUi({ dot: null, progress: 0 });
            onStatusMessageRef.current("視線を検知中...");
            onCalibrationCompleteRef.current();
          }
        },
        5,
      );

      if (!started && !cancelled) {
        setInitError("キャリブレーションを開始できませんでした。");
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      trackingActiveRef.current = false;
      try {
        easyRef.current?.stopTracking();
      } catch {
        /* ignore */
      }
      try {
        easyRef.current?.deinit();
      } catch {
        /* ignore */
      }
      easyRef.current = null;
    };
  }, [bootstrapVersion, enabled]);

  // ── スリープ：トラッキング停止／解除：再開 + キャッシュ済みキャリブレーション適用 ──
  useEffect(() => {
    let cancelled = false;

    async function sleepOrWake() {
      const inst = easyRef.current;
      if (!inst) return;

      if (isSleepMode) {
        try {
          inst.stopTracking();
        } catch {
          /* ignore */
        }
        trackingActiveRef.current = false;
        return;
      }

      if (trackingActiveRef.current) return;

      let TrackingState: typeof import("seeso").TrackingState;
      try {
        const seesoMod = await import("seeso");
        if (cancelled) return;
        TrackingState = seesoMod.TrackingState;
      } catch {
        return;
      }

      const runGazeWake = (gazeInfo: { x: number; y: number; trackingState: number }) => {
        if (cancelled) return;
        setTrackingState(gazeInfo.trackingState);
        const ts = gazeInfo.trackingState;
        if (ts !== TrackingState.SUCCESS && ts !== TrackingState.LOW_CONFIDENCE) return;
        if (!Number.isFinite(gazeInfo.x) || !Number.isFinite(gazeInfo.y)) return;
        const now = Date.now();
        if (now - lastGazeAtRef.current < GAZE_THROTTLE_MS) return;
        lastGazeAtRef.current = now;
        onGazePointRef.current(gazeInfo.x, gazeInfo.y);
        onGazeActivityRef.current();
        onStatusMessageRef.current("視線を検知中...");
      };

      try {
        const ok = await inst.startTracking(runGazeWake, () => {});
        if (cancelled || !ok) return;
        trackingActiveRef.current = true;
        const cached = localStorage.getItem(EYEDID_CAL_KEY);
        if (cached) {
          await inst.setCalibrationData(cached);
        }
      } catch (e) {
        console.error("[Eyedid] wake resume", e);
      }
    }

    void sleepOrWake();

    return () => {
      cancelled = true;
    };
  }, [isSleepMode]);

  return {
    licenseError,
    initError,
    blinkCount,
    attentionScore,
    trackingState,
    calUi,
    skipCalibration,
    setCameraPlacement,
  };
}
