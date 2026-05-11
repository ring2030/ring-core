"use client";

import Link from "next/link";
import { InsightsShell } from "@/components/insights/InsightsShell";
import { KpiCard } from "@/components/insights/KpiCard";
import type { PhilAggregate } from "@/lib/phil/schema";

type Props = {
  date: string;
  data: PhilAggregate | null;
};

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function DayDetailClient({ date, data }: Props) {
  return (
    <InsightsShell>
      {(_locale, copy) => (
        <div className="space-y-8">
          <div>
            <Link
              href="/insights"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              {copy.back_to_insights}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {copy.details_for(date)}
            </h1>
          </div>

          {!data ? (
            <div className="rounded border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
              {copy.no_data_yet}
            </div>
          ) : (
            <>
              {data.insufficient_sample && (
                <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {copy.insufficient_sample}
                </div>
              )}

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label={copy.kpi_total_calls}
                  value={data.sample_size.toLocaleString()}
                />
                <KpiCard
                  label={copy.kpi_emergency_rate}
                  value={fmtPct(data.emergency_rate.value)}
                  ci={data.emergency_rate.ci_95}
                  ciLabel={copy.ci_label}
                  sublabel={copy.sample_label(data.emergency_rate.denominator)}
                />
                <KpiCard
                  label={copy.kpi_ai_completion}
                  value={fmtPct(data.ai_completion_rate.value)}
                  ci={data.ai_completion_rate.ci_95}
                  ciLabel={copy.ci_label}
                  sublabel={copy.sample_label(data.ai_completion_rate.denominator)}
                />
                <KpiCard
                  label={copy.kpi_hospitals}
                  value={String(data.hospitals_count)}
                />
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900">
                  Priority distribution
                </h2>
                <table className="w-full max-w-xl border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">Priority</th>
                      <th className="py-2 pr-4 font-medium">Count</th>
                      <th className="py-2 font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["1", "2", "3", "4", "5"] as const).map((p) => {
                      const c = data.priority_distribution[p];
                      const share =
                        data.sample_size > 0 ? c / data.sample_size : 0;
                      return (
                        <tr key={p} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-mono">{p}</td>
                          <td className="py-2 pr-4 [font-variant-numeric:tabular-nums]">
                            {c.toLocaleString()}
                          </td>
                          <td className="py-2 [font-variant-numeric:tabular-nums]">
                            {fmtPct(share)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900">
                  Reasons (k-anonymized)
                </h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.reason_distribution)
                    .filter(([k]) => k !== "__suppressed__")
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, count]) => (
                      <li
                        key={key}
                        className="flex items-baseline justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <span>{key}</span>
                        <span className="font-mono text-slate-600">{count}</span>
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  {copy.k_anonymity_note(data.k_anonymity_k)}
                </p>
              </section>

              <p className="text-xs text-slate-500">
                {copy.cite_prefix}{" "}
                <em>ring Public Health Insights</em>, {date} (UTC), retrieved{" "}
                {new Date().toISOString().slice(0, 10)}.
              </p>
            </>
          )}
        </div>
      )}
    </InsightsShell>
  );
}
