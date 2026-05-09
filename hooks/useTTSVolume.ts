"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pseudo-volume hook for `SpeechSynthesisUtterance`.
 *
 * Web Speech TTS does not expose a real-time amplitude stream, so we synthesize
 * a smooth oscillating "mouth opening" curve while the engine is speaking and
 * collapse to 0 when it stops. The curve is intentionally non-uniform — two
 * sines at different frequencies — so the lantern's mouth feels organic rather
 * than mechanical.
 *
 * Power on / off via `speaking`. Returns a 0–1 value updated at frame rate.
 */
export function useTTSVolume(speaking: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!speaking) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Defer reset to satisfy React 19's set-state-in-effect rule.
      void Promise.resolve().then(() => {
        if (mountedRef.current) setLevel(0);
      });
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = (now - startedAt) / 1000;
      // Two-sine envelope: a slow articulation rhythm + a faster shimmer.
      const slow = 0.55 + 0.35 * Math.sin(t * 5.0);
      const fast = 0.5 + 0.5 * Math.sin(t * 13.0 + 1.3);
      const v = Math.max(0, Math.min(1, slow * 0.7 + fast * 0.3));
      if (mountedRef.current) setLevel(v);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [speaking]);

  return level;
}
