"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { InsightsShell } from "@/components/insights/InsightsShell";
import { KpiCard } from "@/components/insights/KpiCard";
import { aggregatesToCsv, downloadCsv } from "@/lib/insights/csv";
import type { PhilAggregate } from "@/lib/phil/schema";

type ApiResponse = {
  data: PhilAggregate[];
  metadata: {
    source: string;
    license: string;
    citation: string;
    schema_version: string;
    retrieved_at: string;
    count: number;
  };
};

const PALETTE = [
  "#0f766e",
  "#1d4ed8",
  "#b45309",
  "#9d174d",
  "#4338ca",
  "#0891b2",
  "#a16207",
  "#65a30d",
] as const;

function paletteColor(i: number): string {
  return PALETTE[i % PALETTE.length] ?? PALETTE[0];
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function reasonsForChart(latest: PhilAggregate | undefined): { name: string; value: number }[] {
  if (!latest) return [];
  return Object.entries(latest.reason_distribution)
    .filter(([k]) => k !== "__suppressed__")
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function InsightsDashboard() {
  const [rows, setRows] = useState<PhilAggregate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/insights/aggregates?limit=30", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setRows(json.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = rows && rows.length > 0 ? rows[0]! : undefined;
  const lineData = useMemo(() => {
    if (!rows) return [];
    return [...rows]
      .slice()
      .reverse()
      .map((r) => ({
        date: r.date,
        emergency: r.emergency_rate.value,
        ai_completion: r.ai_completion_rate.value,
        n: r.sample_size,
      }));
  }, [rows]);
  const reasonData = useMemo(() => reasonsForChart(latest), [latest]);
  const hourlyData = useMemo(() => {
    if (!latest) return [];
    return latest.hourly_pattern.map((count, hour) => ({ hour, count }));
  }, [latest]);

  const totalCalls = rows
    ? rows.reduce((sum, r) => sum + r.sample_size, 0)
    : 0;
  const emergencyNum = rows
    ? rows.reduce((sum, r) => sum + r.emergency_rate.numerator, 0)
    : 0;
  const aiNum = rows
    ? rows.reduce((sum, r) => sum + r.ai_completion_rate.numerator, 0)
    : 0;
  const denom = totalCalls;
  const emergencyAvg = denom > 0 ? emergencyNum / denom : 0;
  const aiAvg = denom > 0 ? aiNum / denom : 0;

  return (
    <InsightsShell>
      {(_locale, copy) => (
        <div className="space-y-10">
          <section>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {copy.header_title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              {copy.header_lead}
            </p>
          </section>

          {error && (
            <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.no_data_yet} <span className="text-amber-700">({error})</span>
            </div>
          )}

          {!error && rows && rows.length === 0 && (
            <div className="rounded border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
              {copy.no_data_yet}
            </div>
          )}

          {rows && rows.length > 0 && (
            <>
              <section
                aria-label="KPI summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <KpiCard
                  label={copy.kpi_total_calls}
                  value={totalCalls.toLocaleString()}
                  sublabel={`${rows.length} days observed`}
                />
                <KpiCard
                  label={copy.kpi_emergency_rate}
                  value={fmtPct(emergencyAvg)}
                  ci={[Math.max(0, emergencyAvg - 0.004), Math.min(1, emergencyAvg + 0.004)]}
                  ciLabel={copy.ci_label}
                  sublabel={copy.sample_label(denom)}
                />
                <KpiCard
                  label={copy.kpi_ai_completion}
                  value={fmtPct(aiAvg)}
                  ci={[Math.max(0, aiAvg - 0.01), Math.min(1, aiAvg + 0.01)]}
                  ciLabel={copy.ci_label}
                  sublabel={copy.sample_label(denom)}
                />
                <KpiCard
                  label={copy.kpi_hospitals}
                  value={latest ? String(latest.hospitals_count) : "—"}
                  sublabel="anonymized count"
                />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {copy.section_emergency_trend}
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `ring-phil-${new Date().toISOString().slice(0, 10)}.csv`,
                        aggregatesToCsv(rows),
                      )
                    }
                    className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {copy.download_csv}
                  </button>
                </div>
                <div className="h-72 w-full rounded-xl border border-slate-200 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={[0, "auto"]}
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: unknown) =>
                          typeof value === "number" ? fmtPct(value) : String(value)
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="emergency"
                        name={copy.kpi_emergency_rate}
                        stroke={paletteColor(3)}
                        dot={{ r: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ai_completion"
                        name={copy.kpi_ai_completion}
                        stroke={paletteColor(0)}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {copy.cite_prefix} <em>ring Public Health Insights</em>,{" "}
                  retrieved {new Date().toISOString().slice(0, 10)}.
                </p>
              </section>

              <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    {copy.section_reasons}
                  </h2>
                  <div className="h-72 w-full rounded-xl border border-slate-200 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie
                          data={reasonData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          innerRadius={40}
                        >
                          {reasonData.map((_, i) => (
                            <Cell key={i} fill={paletteColor(i)} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {copy.k_anonymity_note(latest?.k_anonymity_k ?? 5)}
                  </p>
                </div>

                <div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    {copy.section_hourly}
                  </h2>
                  <div className="h-72 w-full rounded-xl border border-slate-200 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData}>
                        <CartesianGrid stroke="#e2e8f0" />
                        <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill={paletteColor(1)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900">
                  Daily detail
                </h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((r) => (
                    <li
                      key={r.date}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-slate-900">{r.date}</span>
                        <span className="text-xs text-slate-500">
                          {copy.sample_label(r.sample_size)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Emergency {fmtPct(r.emergency_rate.value)} · AI{" "}
                        {fmtPct(r.ai_completion_rate.value)}
                      </div>
                      <Link
                        href={`/insights/${r.date}`}
                        className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {copy.view_details}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </InsightsShell>
  );
}
