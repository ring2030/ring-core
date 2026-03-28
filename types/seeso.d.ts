/** seeso（Eyedid Web SDK）パッケージ用の最小型定義（公式 @types 無し） */
declare module "seeso/easy-seeso" {
  type GazeCb = (gazeInfo: {
    x: number;
    y: number;
    trackingState: number;
  }) => void;
  type DebugCb = () => void;
  class EasySeeSo {
    init(
      licenseKey: string,
      afterInitialized: () => void,
      afterFailed: () => void,
      userStatusOption?: unknown,
    ): Promise<void>;
    deinit(): void;
    startTracking(onGaze: GazeCb | null, onDebug: DebugCb | null): Promise<boolean>;
    stopTracking(): void;
    setUserStatusCallback(
      onAttention: (a: number, b: number, score: number) => void,
      onBlink: (a: number, b: number, isBlink: boolean) => void,
      onDrowsiness: (...args: unknown[]) => void,
    ): void;
    setCalibrationData(data: string): Promise<void>;
    startCalibration(
      onNext: (x: number, y: number) => void,
      onProgress: (p: number) => void,
      onFinished: (data: string) => void,
      points?: number,
    ): boolean;
    stopCalibration(): boolean;
  }
  export default EasySeeSo;
}

declare module "seeso" {
  export const TrackingState: { SUCCESS: number; LOW_CONFIDENCE: number; FACE_MISSING: number };
  export const UserStatusOption: new (
    attention: boolean,
    blink: boolean,
    drowsiness: boolean,
  ) => { getUserStatusOptions(): unknown[] };
  export const InitializationErrorType: Record<string, number>;
  const Seeso: unknown;
  export default Seeso;
}
