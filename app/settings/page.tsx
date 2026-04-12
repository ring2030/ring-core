"use client";

import Link from "next/link";
import { StaffLinks } from "@/components/dashboard/StaffLinks";

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">ring 設定ページ</h1>
        <p className="mt-2 text-sm text-slate-600">
          スタッフ・家族向け画面へのリンク。ナース・記録・履歴はここからも開けます。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/" className="rounded bg-sky-600 px-4 py-2 text-white">
            守り神モードへ
          </Link>
          <Link href="/kiyoko" className="rounded bg-rose-600 px-4 py-2 text-white">
            旧UI
          </Link>
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ダッシュボード
          </p>
          <StaffLinks />
        </div>
      </div>
    </div>
  );
}
