export type NurseInputMode = "eyedid" | "pointer";

const KEY = "ring_nurse_input_mode";

export function getStoredInputMode(): NurseInputMode {
  if (typeof window === "undefined") return "eyedid";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "pointer" || v === "eyedid") return v;
  } catch {
    /* ignore */
  }
  return "eyedid";
}

export function setStoredInputMode(mode: NurseInputMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
