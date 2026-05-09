"use client";

import Link from "next/link";

export function BottomNav() {
  return (
    <nav
      aria-label="Staff and family shortcuts"
      className="pointer-events-none fixed bottom-2 left-0 right-0 z-[10002] flex justify-center px-2"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-slate-600/60 bg-slate-900/85 px-4 py-2 text-[11px] text-slate-400 shadow-lg backdrop-blur-sm sm:text-xs">
        <Link href="/settings" className="hover:text-white">
          Settings
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard" className="hover:text-white">
          Log
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/family" className="hover:text-white">
          Family
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/nurse" className="hover:text-white">
          Nurse
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/history" className="hover:text-white">
          History
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <a href="/privacy" className="text-xs text-gray-500 hover:text-gray-700">
          Privacy
        </a>
      </div>
    </nav>
  );
}
