"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const GrandmaGazePage = dynamic(() => import("./page-client"), {
  ssr: false,
});

function BootScreen() {
  return (
    <div className="flex min-h-dvh min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center font-sans text-amber-50">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-amber-400/25 border-t-amber-400"
        aria-hidden
      />
      <p className="mt-6 text-lg font-medium tracking-wide">読み込み中…</p>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        カメラと視線の準備には数秒かかることがあります
      </p>
    </div>
  );
}

/**
 * クライアントでマウントするまでメインを描画しない（dynamic ssr:false のサーバー空描画と区別）。
 */
export function HomePageClient() {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setClientReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!clientReady) {
    return <BootScreen />;
  }

  return (
    <ErrorBoundary
      fallback={(err) => (
        <div
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-red-200"
        >
          <p className="text-lg font-bold">画面を表示できませんでした</p>
          <p className="max-w-lg text-sm opacity-90">{err.message}</p>
        </div>
      )}
    >
      <GrandmaGazePage />
    </ErrorBoundary>
  );
}
