/**
 * @mediapipe/face_mesh はブラウザ向け IIFE で ESM エクスポートがなく、Turbopack が束ねられない。
 * face-landmarks-detection の tfjs ランタイムはこのモジュールを実行時に使わない（バンドル先頭の import のみ）。
 */
export class FaceMesh {
  close(): void {}
}
