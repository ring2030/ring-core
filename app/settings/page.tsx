"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">ring 設定ページ</h1>
        <p className="mt-2 text-sm text-slate-600">
          省略していた設定導線を復活しました。必要に応じてここへ調整項目を追加できます。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/" className="rounded bg-sky-600 px-4 py-2 text-white">
            守り神モードへ
          </Link>
          <Link href="/dashboard" className="rounded bg-slate-700 px-4 py-2 text-white">
            記録ダッシュボード
          </Link>
          <Link href="/kiyoko" className="rounded bg-rose-600 px-4 py-2 text-white">
            旧UI
          </Link>
        </div>
      </div>
    </div>
  );
}
