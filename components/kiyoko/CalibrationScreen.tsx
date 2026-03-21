"use client";

import { useEffect, useRef, useState } from "react";

const CAL_POINTS = [
  { rx: 0.1, ry: 0.12 },
  { rx: 0.9, ry: 0.12 },
  { rx: 0.5, ry: 0.5 },
  { rx: 0.1, ry: 0.88 },
  { rx: 0.9, ry: 0.88 },
] as const;

const DWELL_MS = 2000;
const HIT_PX = 80;

interface Props {
  gazeData: { x: number; y: number } | null;
  onComplete: () => void;
  onSkip: () => void;
}

export function CalibrationScreen({ gazeData, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [dwellMs, setDwellMs] = useState(0);
  const [wSize, setWSize] = useState({ w: 0, h: 0 });
  const dwellRef = useRef({ since: 0, lastAt: 0 });
  const doneRef = useRef(false);
  const stepRef = useRef(0);

  useEffect(() => {
    const update = () =>
      setWSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    stepRef.current = step;
    dwellRef.current = { since: 0, lastAt: 0 };
    setDwellMs(0);
  }, [step]);

  const pt = CAL_POINTS[step] ?? CAL_POINTS[0];
  const px = wSize.w * pt.rx;
  const py = wSize.h * pt.ry;

  function doAdvance(currentPx: number, currentPy: number) {
    if (doneRef.current) return;
    try {
      const wg = (window as any).webgazer;
      for (let i = 0; i < 5; i++) wg?.recordScreenPosition(currentPx, currentPy);
    } catch {}
    const next = stepRef.current + 1;
    if (next >= CAL_POINTS.length) {
      doneRef.current = true;
      onComplete();
    } else {
      setStep(next);
    }
  }

  useEffect(() => {
    if (!gazeData || wSize.w === 0) return;
    const { x, y } = gazeData;
    const inRange = Math.abs(x - px) < HIT_PX && Math.abs(y - py) < HIT_PX;
    const now = Date.now();

    if (inRange) {
      if (dwellRef.current.since === 0) dwellRef.current.since = now;
      dwellRef.current.lastAt = now;
      const elapsed = now - dwellRef.current.since;
      setDwellMs(elapsed);
      try {
        (window as any).webgazer?.recordScreenPosition(px, py);
      } catch {}
      if (elapsed >= DWELL_MS) {
        dwellRef.current.since = 0;
        doAdvance(px, py);
      }
    } else if (now - dwellRef.current.lastAt > 600) {
      if (dwellRef.current.since !== 0) {
        dwellRef.current.since = 0;
        setDwellMs(0);
      }
    }
  }, [gazeData, px, py]);

  const progress = Math.min(dwellMs / DWELL_MS, 1);
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm">
      {/* Instructions */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center pt-10 text-center">
        <p className="text-3xl font-bold text-white">視線の教育</p>
        <p className="mt-2 text-lg text-cyan-300">
          この点を見つめてください —{" "}
          <span className="font-bold">
            {step + 1} / {CAL_POINTS.length}
          </span>
        </p>
        <p className="mt-1 text-sm text-white/50">
          タップするか、2秒間見つめると次へ進みます
        </p>
      </div>

      {/* Calibration dot */}
      {wSize.w > 0 && (
        <button
          type="button"
          onClick={() => doAdvance(px, py)}
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={{ left: px, top: py }}
          aria-label={`キャリブレーション点 ${step + 1}`}
        >
          <svg width={110} height={110} viewBox="0 0 110 110">
            {/* Outer glow ring */}
            <circle
              cx="55"
              cy="55"
              r={R}
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
            />
            {/* Progress arc */}
            <circle
              cx="55"
              cy="55"
              r={R}
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 55 55)"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
            {/* Center dot */}
            <circle cx="55" cy="55" r="10" fill="white" />
          </svg>
        </button>
      )}

      {/* Step indicators + skip */}
      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4">
        <div className="flex gap-3">
          {CAL_POINTS.map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                i < step
                  ? "bg-cyan-400"
                  : i === step
                    ? "scale-125 bg-white"
                    : "bg-white/30"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-white/40 underline hover:text-white/70"
        >
          スキップ（精度が下がります）
        </button>
      </div>
    </div>
  );
}
