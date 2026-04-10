export interface HistoryCall {
  reason: string;
  priority: number;
}

export function dateLabel(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`;
}

export function buildHighlight(calls: HistoryCall[], dateStr: string): string {
  if (calls.length === 0) return `${dateStr}は記録がありませんでした。穏やかな一日だったようです。`;

  const aiCount = calls.filter((c) => c.priority <= 2).length;
  const nurseCount = calls.filter((c) => c.priority >= 3).length;
  const urgentCount = calls.filter((c) => c.priority >= 4).length;

  const reasons = [...new Set(calls.map((c) => c.reason))].slice(0, 3).join("・");
  const total = calls.length;

  let msg = `この日は ${total} 回、きよ子さんからお声がけがありました（${reasons} など）。`;

  if (aiCount > 0 && nurseCount === 0) {
    msg += " すべてのご要望にAIがお答えし、きよ子さんは穏やかに過ごされていました。🌸";
  } else if (urgentCount > 0) {
    msg += " うち " + urgentCount + " 件は急ぎの対応が必要で、みっちゃんがすぐに駆けつけました。安心してお任せください。";
  } else {
    msg += ` AIが ${aiCount} 件のお話を聞き、みっちゃんが ${nurseCount} 件の介助をしました。しっかり見守っています。`;
  }

  return msg;
}
