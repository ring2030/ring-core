import Link from "next/link";

/** Cross-links between staff and family views */
export function StaffLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Staff and family pages"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}
    >
      <Link href="/" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        Home
      </Link>
      <Link href="/settings" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        Settings
      </Link>
      <Link href="/dashboard" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        Log
      </Link>
      <Link href="/dashboard/family" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        Family
      </Link>
      <Link href="/dashboard/nurse" className="rounded-lg bg-rose-100 px-3 py-1.5 font-medium text-rose-900 hover:bg-rose-200">
        Nurse
      </Link>
      <Link href="/login" className="rounded-lg bg-cyan-100 px-3 py-1.5 font-medium text-cyan-900 hover:bg-cyan-200">
        Sign in
      </Link>
      <Link href="/dashboard/history" className="rounded-lg bg-slate-200 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-300">
        History
      </Link>
    </nav>
  );
}
