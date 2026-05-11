import type { Metadata } from "next";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";

export const metadata: Metadata = {
  title: "ring Public Health Insights",
  description:
    "Anonymized, aggregated nurse-call data from the ring platform. Published under CC-BY-4.0 for research and policy use.",
};

export default function InsightsPage() {
  return <InsightsDashboard />;
}
