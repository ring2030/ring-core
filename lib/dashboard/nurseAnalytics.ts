type NurseCall = {
  reason: string;
  priority: number;
  date: Date;
};

type ReasonSlice = {
  name: string;
  value: number;
  color: string;
  emoji: string;
};

type MonthlyPoint = {
  month: string;
  urgent: number;
  aiComfort: number;
};

type NurseKpi = {
  aiResolvedRate: number;
  reducedVisits: number;
  savedMinutes: number;
};

export type NurseAnalytics = {
  reasonData: ReasonSlice[];
  monthlyComparison: MonthlyPoint[];
  kpi: NurseKpi;
  totalReasonCount: number;
};

const MOCK_REASON_DATA: ReasonSlice[] = [
  { name: "Toileting assistance", value: 28, color: "#f97316", emoji: "🚽" },
  { name: "Listening / conversation", value: 22, color: "#60a5fa", emoji: "💬" },
  { name: "Easing anxiety / loneliness", value: 18, color: "#a78bfa", emoji: "🤝" },
  { name: "Hydration / meal support", value: 12, color: "#34d399", emoji: "💧" },
  { name: "Pain / condition care", value: 8, color: "#f87171", emoji: "🚨" },
  { name: "Other", value: 6, color: "#94a3b8", emoji: "📋" },
];

const MOCK_MONTHLY_COMPARISON: MonthlyPoint[] = [
  { month: "Apr", urgent: 45, aiComfort: 0 },
  { month: "May", urgent: 48, aiComfort: 0 },
  { month: "Jun", urgent: 31, aiComfort: 17 },
  { month: "Jul", urgent: 19, aiComfort: 36 },
  { month: "Aug", urgent: 17, aiComfort: 38 },
  { month: "Sep", urgent: 14, aiComfort: 40 },
];

const MOCK_KPI: NurseKpi = { aiResolvedRate: 74, reducedVisits: 31, savedMinutes: 155 };

const REASON_CATEGORIES: Array<{
  name: string;
  color: string;
  emoji: string;
  test: (reason: string) => boolean;
}> = [
  {
    name: "Toileting assistance",
    color: "#f97316",
    emoji: "🚽",
    test: (r) => /restroom|toilet|トイレ|toileting|urgent restroom/i.test(r),
  },
  {
    name: "Listening / conversation",
    color: "#60a5fa",
    emoji: "💬",
    test: (r) => /chat|conversation|お話|listening/i.test(r),
  },
  {
    name: "Easing anxiety / loneliness",
    color: "#a78bfa",
    emoji: "🤝",
    test: (r) => /lonely|anxious|insomnia|不安|寂/i.test(r),
  },
  {
    name: "Hydration / meal support",
    color: "#34d399",
    emoji: "💧",
    test: (r) => /water|tea|drink|hungry|meal|食/i.test(r),
  },
  {
    name: "Pain / condition care",
    color: "#f87171",
    emoji: "🚨",
    test: (r) => /pain|dizzy|unwell|chest|fallen|urgent|救急|痛/i.test(r),
  },
];

function buildLiveReasonData(calls: NurseCall[]): ReasonSlice[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    const reason = call.reason ?? "";
    const category = REASON_CATEGORIES.find((c) => c.test(reason));
    const name = category?.name ?? "Other";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const allCategories: ReasonSlice[] = [
    ...REASON_CATEGORIES.map((c) => ({
      name: c.name,
      value: counts.get(c.name) ?? 0,
      color: c.color,
      emoji: c.emoji,
    })),
    { name: "Other", value: counts.get("Other") ?? 0, color: "#94a3b8", emoji: "📋" },
  ];
  return allCategories.filter((c) => c.value > 0);
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short" });
}

function buildLiveMonthlyComparison(calls: NurseCall[]): MonthlyPoint[] {
  const now = new Date();
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months.map((monthStart) => {
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();
    const monthCalls = calls.filter((c) => c.date.getFullYear() === y && c.date.getMonth() === m);
    return {
      month: monthLabel(monthStart),
      urgent: monthCalls.filter((c) => c.priority >= 3).length,
      aiComfort: monthCalls.filter((c) => c.priority <= 2).length,
    };
  });
}

function buildLiveKpi(calls: NurseCall[]): NurseKpi {
  const total = calls.length;
  if (total === 0) return { aiResolvedRate: 0, reducedVisits: 0, savedMinutes: 0 };
  const aiHandled = calls.filter((c) => c.priority <= 2).length;
  const reducedVisits = aiHandled;
  return {
    aiResolvedRate: Math.round((aiHandled / total) * 100),
    reducedVisits,
    savedMinutes: reducedVisits * 5,
  };
}

export function buildNurseAnalytics(calls: NurseCall[], useLiveAnalytics: boolean): NurseAnalytics {
  if (!useLiveAnalytics) {
    return {
      reasonData: MOCK_REASON_DATA,
      monthlyComparison: MOCK_MONTHLY_COMPARISON,
      kpi: MOCK_KPI,
      totalReasonCount: MOCK_REASON_DATA.reduce((sum, item) => sum + item.value, 0),
    };
  }
  const reasonData = buildLiveReasonData(calls);
  return {
    reasonData,
    monthlyComparison: buildLiveMonthlyComparison(calls),
    kpi: buildLiveKpi(calls),
    totalReasonCount: reasonData.reduce((sum, item) => sum + item.value, 0),
  };
}

