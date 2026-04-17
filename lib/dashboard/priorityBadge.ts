import type { BadgeTone } from "@/components/ui/ThemePrimitives";

type PriorityBadge = {
  label: string;
  tone: BadgeTone;
};

export function getPriorityBadge(priority: number): PriorityBadge {
  if (priority >= 5) return { label: "Critical", tone: "danger" };
  if (priority === 4) return { label: "Urgent", tone: "warning" };
  if (priority === 3) return { label: "Routine", tone: "warning" };
  if (priority === 2) return { label: "Watch", tone: "info" };
  return { label: "Log only", tone: "neutral" };
}
