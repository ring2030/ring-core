import type { PhilAggregate } from "@/lib/phil/schema";

const HEADER = [
  "date",
  "sample_size",
  "hospitals_count",
  "emergency_rate",
  "emergency_rate_ci_low",
  "emergency_rate_ci_high",
  "ai_completion_rate",
  "ai_completion_rate_ci_low",
  "ai_completion_rate_ci_high",
  "priority_1",
  "priority_2",
  "priority_3",
  "priority_4",
  "priority_5",
  "staff_time_saved_min",
  "insufficient_sample",
  "schema_version",
];

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function aggregatesToCsv(rows: readonly PhilAggregate[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const cells = [
      r.date,
      r.sample_size,
      r.hospitals_count,
      r.emergency_rate.value,
      r.emergency_rate.ci_95[0],
      r.emergency_rate.ci_95[1],
      r.ai_completion_rate.value,
      r.ai_completion_rate.ci_95[0],
      r.ai_completion_rate.ci_95[1],
      r.priority_distribution["1"],
      r.priority_distribution["2"],
      r.priority_distribution["3"],
      r.priority_distribution["4"],
      r.priority_distribution["5"],
      r.staff_time_saved_estimate_min,
      r.insufficient_sample ? "true" : "false",
      r.schema_version,
    ];
    lines.push(cells.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, contents: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
