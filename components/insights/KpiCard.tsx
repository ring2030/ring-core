type Props = {
  label: string;
  value: string;
  sublabel?: string;
  /** Optional Wilson 95% CI tuple, rendered like "[0.013–0.022]". */
  ci?: [number, number];
  ciLabel?: string;
};

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function KpiCard({ label, value, sublabel, ci, ciLabel }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      {ci && (
        <div className="mt-1 text-xs text-slate-600 [font-variant-numeric:tabular-nums]">
          {ciLabel ?? "95% CI"} [{fmtPct(ci[0])} – {fmtPct(ci[1])}]
        </div>
      )}
      {sublabel && (
        <div className="mt-1 text-xs text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}
