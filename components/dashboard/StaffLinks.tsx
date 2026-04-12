import Link from "next/link";

/** スタッフ・家族向け画面の相互リンク（各ダッシュから迷子にならないように） */
export function StaffLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="スタッフ・家族向けページ"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}
    >
      <Link href="/" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        ホーム
      </Link>
      <Link href="/settings" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        設定
      </Link>
      <Link href="/dashboard" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        記録
      </Link>
      <Link href="/dashboard/family" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        家族
      </Link>
      <Link href="/dashboard/nurse" className="rounded-lg bg-rose-100 px-3 py-1.5 font-medium text-rose-900 hover:bg-rose-200">
        ナース
      </Link>
      <Link href="/dashboard/history" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        履歴
      </Link>
    </nav>
  );
}
