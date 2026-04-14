const KEY = "ring_iris_camera_device_id";

export function getStoredIrisCameraId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = localStorage.getItem(KEY);
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export function setStoredIrisCameraId(id: string | undefined): void {
  try {
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
