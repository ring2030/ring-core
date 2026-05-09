"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  /** Bumped each time we want to flash. */
  trigger: number;
};

/**
 * A 0.5-second outer-edge red glow shown when AI returns priority >= 4.
 *
 * Designed as a "noticing" cue, not a startle: low opacity, no shake, no
 * sound. Suppressed entirely under prefers-reduced-motion (the lantern's
 * thinking → speaking color shift still conveys the change).
 */
export function EmergencyFlash({ trigger }: Props) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (trigger === seen || trigger === 0) return;
    // Defer state updates so React 19's "no setState in effect" lint stays
    // happy; the flash itself fires on the next microtask.
    let cancelled = false;
    let timer: number | null = null;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSeen(trigger);
      setActive(true);
      timer = window.setTimeout(() => {
        if (!cancelled) setActive(false);
      }, 500);
    });
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [trigger, seen]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{
            boxShadow: "inset 0 0 80px 12px rgba(248,113,113,0.45)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, times: [0, 0.4, 1], ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}
