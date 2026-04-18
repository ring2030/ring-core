"use client";

type Props = {
  onWakeUp: () => void;
};

export function SleepOverlay({ onWakeUp }: Props) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-8 cursor-pointer select-none"
      style={{ background: "rgba(2,6,23,0.97)" }}
      onClick={onWakeUp}
    >
      {/* Subtle radial glow behind the icon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 48%, rgba(99,102,241,0.07) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <span className="text-[7rem] leading-none animate-[pulse_3s_ease-in-out_infinite]" aria-hidden>
        💤
      </span>

      <p className="text-slate-400 text-2xl font-bold tracking-widest uppercase">
        Screen sleeping
      </p>

      <button
        type="button"
        className="mt-1 px-14 py-5 bg-slate-800/90 hover:bg-slate-700/90 active:scale-[0.97] text-white text-xl font-bold rounded-full shadow-2xl border border-slate-600/60 backdrop-blur transition-all"
      >
        Tap anywhere to wake
      </button>

      <p className="text-slate-600 text-sm mt-2">
        Camera is paused to save power
      </p>
    </div>
  );
}
