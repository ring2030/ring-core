const KEY = "ring_eyedid_camera_top";

/** true: モニタ上 / false: 下。未設定は null */
export function getEyedidCameraOnTop(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch {
    /* ignore */
  }
  return null;
}

export function setEyedidCameraOnTop(onTop: boolean): void {
  try {
    localStorage.setItem(KEY, onTop ? "1" : "0");
  } catch {
    /* ignore */
  }
}
