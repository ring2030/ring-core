import type { BadgeTone } from "@/components/ui/ThemePrimitives";

type PriorityBadge = {
  label: string;
  tone: BadgeTone;
};

export function getPriorityBadge(priority: number): PriorityBadge {
  if (priority >= 5) return { label: "最優先", tone: "danger" };
  if (priority === 4) return { label: "急ぎ対応", tone: "warning" };
  if (priority === 3) return { label: "通常対応", tone: "warning" };
  if (priority === 2) return { label: "経過観察", tone: "info" };
  return { label: "記録のみ", tone: "neutral" };
}
