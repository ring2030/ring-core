/**
 * @mediapipe/face_detection はブラウザ向け IIFE で ESM named export がなく Turbopack/webpack が束ねられない。
 * face-detection の tfjs ランタイムはこのモジュールを実行時に使わない（MediaPipe ランタイム専用）。
 */
export class FaceDetection {
  close(): void {}
}
