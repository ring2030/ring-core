"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { StatusBadge, type BadgeTone } from "@/components/ui/ThemePrimitives";
import { emojiForReason, normalizeReasonLabel } from "@/lib/calls/reasons";

/**
 * Client-only wall clock for relative timestamps. Must not call `Date.now()`
 * inside `useSyncExternalStore`'s getSnapshot — a new number every render
 * triggers an infinite re-render loop and breaks the nurse dashboard.
 */
function useNow(intervalMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- single mount tick for client-only clock
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CallRow {
  id: string;
  reason: string;
  summary: string;
  /** Voice / STT line when AI summary is missing */
  transcript?: string;
  /** Staff note (e.g. gaze / triage context) */
  staffNote?: string;
  priority: number;
  sender: string;
  date: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_ROWS = 25;

/**
 * ActivityLog uses its own priority tone mapping (independent of the Patient
 * Card / Toast badges) so that the table reads as a quick triage glance:
 *   1-2: neutral grey, 3: amber, 4-5: red.
 */
function activityTone(priority: number): BadgeTone {
  if (priority >= 4) return "danger";
  if (priority === 3) return "warning";
  return "neutral";
}

function priorityLabel(priority: number): string {
  if (priority <= 0) return "P1";
  if (priority >= 5) return "P5";
  return `P${Math.round(priority)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHHMM(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs)) return "";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24 && isSameDay(date, now)) return `${diffH}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday ${formatHHMM(date)}`;

  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "2-digit" };
  if (date.getFullYear() !== now.getFullYear()) {
    dateOpts.year = "numeric";
  }
  return `${date.toLocaleDateString("en-US", dateOpts)} ${formatHHMM(date)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ActivityLog({ calls }: { calls: CallRow[] }) {
  // Compute "now" only on the client (and refresh every minute) so the
  // relative timestamps stay current without breaking SSR equality.
  // We use useSyncExternalStore so the initial value comes from a snapshot
  // rather than a setState-in-effect (which the linter rightfully flags).
  const now = useNow(60_000);

  const rows = calls.slice(0, MAX_ROWS);

  return (
    <div className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-400">
          <Bell className="h-3.5 w-3.5 animate-pulse text-emerald-400" /> Activity
        </h2>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          <span className="text-[10px] font-black text-stone-400">LIVE</span>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-stone-100">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-stone-50">
            <tr>
              {["Time", "From", "Reason", "Priority", "Note / voice"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-stone-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((c) => {
              const reasonLabel = normalizeReasonLabel(c.reason);
              const time = now ? formatRelative(c.date, now) : formatHHMM(c.date);
              return (
                <tr
                  key={c.id}
                  className={`transition-colors ${
                    c.priority >= 4 ? "bg-red-50 hover:bg-red-100" : "hover:bg-stone-50"
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-stone-400">
                    {time}
                  </td>
                  <td className="px-4 py-3 font-bold text-stone-700">{c.sender}</td>
                  <td className="px-4 py-3 font-bold text-stone-700">
                    {emojiForReason(reasonLabel)} {reasonLabel}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={activityTone(c.priority)}>
                      {priorityLabel(c.priority)}
                    </StatusBadge>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-500">
                    {c.summary ? (
                      <span className="line-clamp-2 leading-snug">{c.summary}</span>
                    ) : null}
                    {!c.summary && c.transcript ? (
                      <span className="line-clamp-2 text-stone-600 leading-snug">
                        <span className="font-semibold text-stone-500">Voice: </span>
                        {c.transcript}
                      </span>
                    ) : null}
                    {!c.summary && !c.transcript && c.staffNote ? (
                      <span className="line-clamp-2 leading-snug text-stone-600">{c.staffNote}</span>
                    ) : null}
                    {!c.summary && !c.transcript && !c.staffNote ? (
                      <span className="text-stone-400">&mdash;</span>
                    ) : null}
                    {c.summary && c.transcript && c.transcript.trim() !== c.summary.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-stone-500">
                        <span className="font-medium">Voice: </span>
                        {c.transcript}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center font-bold text-stone-300">
                  No entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
