import { ScreenRecordDemo } from "@/components/kiyoko/ScreenRecordDemo";
import Link from "next/link";

export default function DemoRecordPage() {
  return (
    <div className="relative">
      <ScreenRecordDemo />
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100004] -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950/85 px-4 py-2 text-xs text-slate-300 shadow-xl">
        <span className="font-semibold text-cyan-300">Judge flow:</span> /demo (record) → /demo-1min (evidence)
      </div>
      <div className="fixed bottom-4 right-4 z-[100005] flex gap-2 text-xs">
        <Link
          href="/demo-1min"
          className="rounded-full border border-cyan-500/60 bg-cyan-500/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-500/25"
        >
          Open /demo-1min
        </Link>
        <Link
          href="/dashboard/nurse"
          className="rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          Open nurse dashboard
        </Link>
      </div>
    </div>
  );
}
