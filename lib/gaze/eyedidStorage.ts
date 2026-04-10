/** Eyedid SDK が返すキャリブレーション文字列（端末に保存） */
export const EYEDID_CAL_KEY = "kiyoko_eyedid_cal_v1";

/** 最後にキャリブレーションした時刻（24時間以内なら再教育を省略可能） */
export const CAL_TS_KEY = "kiyoko_cal_ts";

/** キャリブデータの有効期限（ミリ秒） */
export const EYEDID_CAL_TTL_MS = 24 * 60 * 60 * 1000;

/** 端末に保存されたキャリブが期限内か（SSR では常に false） */
export function hasFreshEyedidCalibration(): boolean {
  if (typeof window === "undefined") return false;
  const ts = localStorage.getItem(CAL_TS_KEY);
  const cal = localStorage.getItem(EYEDID_CAL_KEY);
  if (!ts || !cal) return false;
  const t = parseInt(ts, 10);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < EYEDID_CAL_TTL_MS;
}
