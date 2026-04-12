/** TrackingState の数値を日本語ラベルに変換する */
export function trackingLabel(state: number | null): string {
  if (state === 0) return "良好";
  if (state === 1) return "やや不安定";
  if (state === 2) return "未対応";
  if (state === 3) return "顔が見えない";
  return "待機中";
}
