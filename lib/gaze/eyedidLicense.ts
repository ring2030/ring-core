/**
 * Eyedid（npm パッケージ名: seeso）のライセンスキーを環境変数から取得します。
 * ブラウザにバンドルされるため `NEXT_PUBLIC_` プレフィックスが必要です。
 */
export function getEyedidLicenseKey(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const key = process.env.NEXT_PUBLIC_EYEDID_LICENSE_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}
