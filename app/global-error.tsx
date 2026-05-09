"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <main className="max-w-lg px-6 py-8 rounded-xl border border-neutral-800 bg-neutral-900/70">
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-neutral-300 mb-5">
            An unexpected error occurred. The team has been notified.
          </p>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
