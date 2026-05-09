export const HOSPITAL_COOKIE_NAME = "ring_hospital";
export const DEFAULT_HOSPITAL_ID = "demo-hospital";

type NurseHospitalMap = Record<string, string>;

const STATIC_NURSE_HOSPITAL_MAP: NurseHospitalMap = {
  "1": DEFAULT_HOSPITAL_ID,
};

function normalizeHospitalId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

export function resolveHospitalIdForNurse(nurseId: string): string {
  const envRaw = process.env["NURSE_HOSPITAL_MAP"]?.trim();
  if (envRaw) {
    try {
      const parsed = JSON.parse(envRaw) as NurseHospitalMap;
      const fromEnv = parsed[nurseId];
      if (typeof fromEnv === "string" && fromEnv.trim()) {
        return normalizeHospitalId(fromEnv);
      }
    } catch {
      // Fall back to static mapping when env JSON is invalid.
    }
  }
  const staticValue = STATIC_NURSE_HOSPITAL_MAP[nurseId];
  if (staticValue) return normalizeHospitalId(staticValue);
  return DEFAULT_HOSPITAL_ID;
}

export function resolveHospitalIdsForNurseFromStaticMap(nurseId: string): string[] {
  const single = resolveHospitalIdForNurse(nurseId);
  const envRaw = process.env["NURSE_HOSPITALS_MAP"]?.trim();
  if (!envRaw) return [single];
  try {
    const parsed = JSON.parse(envRaw) as Record<string, string[]>;
    const list = Array.isArray(parsed[nurseId]) ? parsed[nurseId] : [];
    const normalized = list
      .map((id) => normalizeHospitalId(String(id)))
      .filter(Boolean);
    if (normalized.length === 0) return [single];
    return [...new Set(normalized)];
  } catch {
    return [single];
  }
}

export function getCallsCollectionNameForHospital(hospitalId: string): string {
  // Keep legacy collection for current demo login so existing screens stay unchanged.
  if (hospitalId === DEFAULT_HOSPITAL_ID) return "calls";
  return `calls__${normalizeHospitalId(hospitalId)}`;
}

