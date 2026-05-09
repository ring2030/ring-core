/**
 * Reads the Eyedid/SeeSo license key from environment variables.
 * This value is used in browser code, so it must use NEXT_PUBLIC_*.
 */
export function getEyedidLicenseKey(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const key = process.env["NEXT_PUBLIC_EYEDID_LICENSE_KEY"]?.trim();
  return key && key.length > 0 ? key : undefined;
}
