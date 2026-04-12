"use client";

import Link from "next/link";

export function BottomNav() {
  return (
    <nav
      aria-label="スタッフ・家族向けページ"
      className="pointer-events-none fixed bottom-2 left-0 right-0 z-[10002] flex justify-center px-2"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-slate-600/60 bg-slate-900/85 px-4 py-2 text-[11px] text-slate-400 shadow-lg backdrop-blur-sm sm:text-xs">
        <Link href="/settings" className="hover:text-white">
          設定・メニュー
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard" className="hover:text-white">
          記録
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/family" className="hover:text-white">
          家族
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/nurse" className="hover:text-white">
          ナース
        </Link>
        <span className="text-slate-600" aria-hidden>|</span>
        <Link href="/dashboard/history" className="hover:text-white">
          履歴
        </Link>
      </div>
    </nav>
  );
}
