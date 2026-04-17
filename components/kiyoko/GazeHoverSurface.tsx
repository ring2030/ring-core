"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const HOVER_MS = 2000;

type GazeData = { x: number; y: number };

type GazeHoverSurfaceProps = {
  children: ReactNode;
  onActivate: () => void;
  disabled?: boolean;
  gazeData?: GazeData | null;
  className?: string;
  /** Progress ring color (stroke) */
  ringColor?: string;
  "aria-label"?: string;
};

export function GazeHoverSurface({
  children,
  onActivate,
  disabled,
  gazeData = null,
  className = "",
  ringColor = "rgba(255,255,255,0.95)",
  "aria-label": ariaLabel,
}: GazeHoverSurfaceProps) {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const clearRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearRaf();
    startTimeRef.current = null;
    activeRef.current = false;
    setProgress(0);
  }, [clearRaf]);

  const tick = useCallback(function tick(now: number) {
      if (!startTimeRef.current || !activeRef.current || disabled) {
        return;
      }
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / HOVER_MS);
      setProgress(p);
      if (p >= 1) {
        clearRaf();
        activeRef.current = false;
        startTimeRef.current = null;
        setProgress(0);
        onActivate();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [clearRaf, disabled, onActivate],
  );

  const onPointerEnter = useCallback(() => {
    if (disabled) return;
    activeRef.current = true;
    startTimeRef.current = performance.now();
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  const onPointerLeave = useCallback(() => {
    activeRef.current = false;
    reset();
  }, [reset]);

  useEffect(() => {
    return () => clearRaf();
  }, [clearRaf]);

  useEffect(() => {
    if (disabled || !gazeData) {
      // Pause dwell when gaze is missing or disabled
      onPointerLeave();
      return;
    }

    const elAtPoint = document.elementFromPoint(gazeData.x, gazeData.y);
    const surface = elAtPoint?.closest<HTMLElement>(
      '[data-gaze-hover-surface="true"]',
    );
    const isThisSurface = surface === rootRef.current;

    if (isThisSurface) {
      if (!activeRef.current) onPointerEnter();
    } else {
      if (activeRef.current) onPointerLeave();
    }
  }, [disabled, gazeData, onPointerEnter, onPointerLeave]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-gaze-hover-surface="true"
      data-gaze-disabled={disabled ? "true" : "false"}
      className={`relative select-none ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      <svg
        className="pointer-events-none absolute inset-0 m-auto size-[min(28vmin,11rem)] opacity-90"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 60 60)"
          style={{ transition: progress === 0 ? "stroke-dashoffset 0.15s" : undefined }}
        />
      </svg>
      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center">
        {children}
      </div>
      <p className="pointer-events-none absolute bottom-4 left-0 right-0 z-[1] text-center text-sm font-medium opacity-80 max-[480px]:bottom-2 max-[480px]:text-xs">
        Hold still ~2s to confirm
      </p>
    </div>
  );
}
