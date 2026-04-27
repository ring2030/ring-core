import {
  DEFAULT_HOSPITAL_ID,
  HOSPITAL_COOKIE_NAME,
  getCallsCollectionNameForHospital,
} from "@/lib/auth/hospitalScope";

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((v) => v.trim());
  const pair = cookies.find((entry) => entry.startsWith(`${name}=`));
  if (!pair) return null;
  const value = pair.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function getCurrentHospitalIdFromCookie(): string {
  return readCookieValue(HOSPITAL_COOKIE_NAME) ?? DEFAULT_HOSPITAL_ID;
}

export function getCallsCollectionNameForCurrentHospital(): string {
  return getCallsCollectionNameForHospital(getCurrentHospitalIdFromCookie());
}

