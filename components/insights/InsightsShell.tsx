"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { copyFor, type InsightsLocale } from "@/lib/insights/i18n";

type Props = {
  children: (locale: InsightsLocale, copy: ReturnType<typeof copyFor>) => ReactNode;
  /** Optional initial locale override. Defaults to English. */
  initialLocale?: InsightsLocale;
};

/**
 * Shared chrome for every page under /insights/*.
 *
 * Carries:
 *  - the EN/JA locale toggle (default EN for international audience)
 *  - a thin top nav linking the methodology / references / ethics / press /
 *    public-API surfaces
 *  - a footer note with CC-BY-4.0 license + citation guidance
 *
 * Pages render their own bodies via the `children` render-prop so they get
 * the active locale and copy without re-doing the toggle plumbing.
 */
export function InsightsShell({ children, initialLocale = "en" }: Props) {
  const [locale, setLocale] = useState<InsightsLocale>(initialLocale);
  const copy = copyFor(locale);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/insights" className="text-sm font-semibold tracking-wide text-slate-900 hover:underline">
            ring · PHIL
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <Link href="/insights/methodology" className="hover:underline">{copy.methodology_link}</Link>
            <Link href="/insights/references" className="hover:underline">{copy.references_link}</Link>
            <Link href="/insights/ethics" className="hover:underline">{copy.ethics_link}</Link>
            <Link href="/insights/press" className="hover:underline">{copy.press_link}</Link>
            <a
              href="/api/v1/insights/aggregates"
              className="rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-700 hover:bg-slate-100"
            >
              {copy.api_link}
            </a>
            <button
              type="button"
              onClick={() => setLocale((prev) => (prev === "en" ? "ja" : "en"))}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              aria-label={`Switch language to ${copy.toggle_label}`}
            >
              {copy.toggle_label}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 [font-variant-numeric:tabular-nums]">
        {children(locale, copy)}
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500">
          <p>
            <strong>License:</strong> Aggregated data is published under{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              className="underline hover:text-slate-700"
            >
              CC-BY-4.0
            </a>
            . Cite as: <em>ring Public Health Insights</em>, retrieved on the date of access.
          </p>
          <p className="mt-2">
            <strong>k-anonymity:</strong> categories with fewer than 5 observations are suppressed.
            See <Link href="/insights/methodology" className="underline hover:text-slate-700">methodology</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
