export interface HistoryCall {
  reason: string;
  priority: number;
}

export function dateLabel(date: Date): string {
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} (${weekday})`;
}

export function buildHighlight(calls: HistoryCall[], dateStr: string): string {
  if (calls.length === 0) {
    return `${dateStr} has no logged calls. Sounds like a calm day.`;
  }

  const aiCount = calls.filter((c) => c.priority <= 2).length;
  const nurseCount = calls.filter((c) => c.priority >= 3).length;
  const urgentCount = calls.filter((c) => c.priority >= 4).length;

  const reasons = [...new Set(calls.map((c) => c.reason))].slice(0, 3).join(", ");
  const total = calls.length;

  let msg = `That day, Kiyoko reached out ${total} time(s) (${reasons}${reasons ? ", " : ""}etc.).`;

  if (aiCount > 0 && nurseCount === 0) {
    msg += " AI handled everything; she seemed comfortable. 🌸";
  } else if (urgentCount > 0) {
    msg += ` ${urgentCount} needed urgent help — staff responded right away.`;
  } else {
    msg += ` AI listened on ${aiCount} call(s); staff assisted on ${nurseCount}. She’s being watched over.`;
  }

  return msg;
}
