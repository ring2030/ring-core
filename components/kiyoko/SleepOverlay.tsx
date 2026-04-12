"use client";

type Props = {
  onWakeUp: () => void;
};

export function SleepOverlay({ onWakeUp }: Props) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-10 cursor-pointer"
      style={{ background: "rgba(0,0,0,0.95)" }}
      onClick={onWakeUp}
    >
      <span className="text-[7rem] animate-pulse select-none">💤</span>
      <p className="text-slate-400 text-3xl font-bold select-none tracking-widest">
        省電力モード
      </p>
      <button
        type="button"
        className="mt-2 px-16 py-6 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-[2rem] font-bold rounded-full shadow-2xl border-2 border-slate-500 transition-all select-none"
      >
        タッチして再開
      </button>
    </div>
  );
}
