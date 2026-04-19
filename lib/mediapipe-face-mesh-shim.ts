/**
 * @mediapipe/face_mesh はブラウザ向け IIFE で ESM named export がなく Turbopack/webpack が束ねられない。
 * face-landmarks-detection の mediapipe ランタイムは solutionPath から動的スクリプト読み込みを行うため、
 * このスタブは実行時には使われない（バンドラーのスタティック解析エラーを防ぐためだけに存在する）。
 * 実際の WASM ファイルは public/@mediapipe/face_mesh/ にセルフホストされている。
 */
export class FaceMesh {
  close(): void {}
}
