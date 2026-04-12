"use client";

import { useEffect, useRef } from "react";
import { GAZE_THROTTLE_MS } from "@/lib/constants";

/**
 * 視線 SDK の代わりに、ポインタ位置（マウス・タッチ・ペン）を「注視点」として流用する。
 * 本番で Eyedid が動かない端末でもナースコールの滞在選択を成立させる。
 */
export function usePointerGaze(opts: {
  enabled: boolean;
  onPoint: (x: number, y: number) => void;
  onActivity: () => void;
}) {
  const { enabled, onPoint, onActivity } = opts;
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const emit = (e: PointerEvent) => {
      const now = Date.now();
      if (now - lastAtRef.current < GAZE_THROTTLE_MS) return;
      lastAtRef.current = now;
      onPoint(e.clientX, e.clientY);
      onActivity();
    };

    const onDown = (e: PointerEvent) => {
      lastAtRef.current = 0;
      emit(e);
    };

    window.addEventListener("pointermove", emit, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      window.removeEventListener("pointermove", emit);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [enabled, onPoint, onActivity]);
}
