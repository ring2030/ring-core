"use client";

import dynamic from "next/dynamic";

const GrandmaGazePage = dynamic(() => import("./page-client"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-900 font-sans text-xl text-slate-400">
      読み込み中…
    </div>
  ),
});

export function HomePageClient() {
  return <GrandmaGazePage />;
}
