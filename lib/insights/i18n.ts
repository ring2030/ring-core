/**
 * Bilingual UI strings for the public Insights surface (/insights/*).
 *
 * Default locale is English — the international research audience is the
 * primary user. Japanese is offered as a runtime toggle. We deliberately
 * keep this as a tiny hand-curated dictionary rather than pulling in a full
 * i18n library; the surface is small and the strings change rarely.
 */

export type InsightsLocale = "en" | "ja";

export const INSIGHTS_LOCALES: InsightsLocale[] = ["en", "ja"];

export type InsightsCopy = {
  header_title: string;
  header_lead: string;
  toggle_label: string;
  kpi_total_calls: string;
  kpi_emergency_rate: string;
  kpi_ai_completion: string;
  kpi_hospitals: string;
  section_emergency_trend: string;
  section_reasons: string;
  section_hourly: string;
  cite_prefix: string;
  download_csv: string;
  permalink: string;
  view_details: string;
  details_for: (date: string) => string;
  insufficient_sample: string;
  k_anonymity_note: (k: number) => string;
  ci_label: string;
  sample_label: (n: number) => string;
  methodology_link: string;
  references_link: string;
  ethics_link: string;
  press_link: string;
  api_link: string;
  back_to_insights: string;
  no_data_yet: string;
};

const EN: InsightsCopy = {
  header_title: "ring Public Health Insights",
  header_lead:
    "What ring observes, every day, from anonymized nurse-call data. Aggregates only — no patient identifiers, no transcripts, no hospital-level disclosure. Published under CC-BY-4.0 for research and policy use.",
  toggle_label: "日本語",
  kpi_total_calls: "Total calls observed",
  kpi_emergency_rate: "Emergency rate (priority ≥4)",
  kpi_ai_completion: "AI-resolved rate (priority ≤2)",
  kpi_hospitals: "Participating facilities",
  section_emergency_trend: "Emergency rate, last 30 days",
  section_reasons: "Reasons (anonymized; small buckets suppressed)",
  section_hourly: "Calls by UTC hour",
  cite_prefix: "Cite this data:",
  download_csv: "Download CSV",
  permalink: "Permalink",
  view_details: "View daily detail →",
  details_for: (date) => `Insights for ${date} (UTC)`,
  insufficient_sample:
    "Sample size below the reliability threshold (n < 30). Point estimates are hidden.",
  k_anonymity_note: (k) =>
    `Categories with fewer than ${k} observations are suppressed (k-anonymity).`,
  ci_label: "95% CI",
  sample_label: (n) => `n = ${n.toLocaleString()}`,
  methodology_link: "Methodology",
  references_link: "References",
  ethics_link: "Ethics & governance",
  press_link: "Press kit",
  api_link: "Public API",
  back_to_insights: "← Back to Insights",
  no_data_yet:
    "No aggregates have been published yet. Data is computed nightly at 00:05 UTC.",
};

const JA: InsightsCopy = {
  header_title: "ring パブリックヘルス・インサイト",
  header_lead:
    "ring が日々のナースコールから観察する集計データ。匿名化済み・施設別の開示なし・書き起こしは含みません。研究・政策利用のため CC-BY-4.0 で公開しています。",
  toggle_label: "English",
  kpi_total_calls: "観測コール数",
  kpi_emergency_rate: "緊急コール率 (priority ≥4)",
  kpi_ai_completion: "AI 完結率 (priority ≤2)",
  kpi_hospitals: "参加施設数",
  section_emergency_trend: "直近 30 日の緊急コール率",
  section_reasons: "理由カテゴリ (匿名化済・小バケットは除外)",
  section_hourly: "時間帯別コール数 (UTC)",
  cite_prefix: "引用:",
  download_csv: "CSV をダウンロード",
  permalink: "パーマリンク",
  view_details: "日別詳細を見る →",
  details_for: (date) => `${date} (UTC) のインサイト`,
  insufficient_sample:
    "サンプル数が信頼性のしきい値 (n < 30) を下回っています。点推定は非表示です。",
  k_anonymity_note: (k) =>
    `観測数 ${k} 件未満のカテゴリは k-匿名性の確保のため非表示です。`,
  ci_label: "95% 信頼区間",
  sample_label: (n) => `n = ${n.toLocaleString()}`,
  methodology_link: "方法論",
  references_link: "参考文献",
  ethics_link: "倫理とガバナンス",
  press_link: "メディア向け資料",
  api_link: "公開 API",
  back_to_insights: "← インサイトへ戻る",
  no_data_yet:
    "公開済みの集計はまだありません。毎日 UTC 0:05 に集計が走ります。",
};

const COPY: Record<InsightsLocale, InsightsCopy> = { en: EN, ja: JA };

export function copyFor(locale: InsightsLocale): InsightsCopy {
  return COPY[locale];
}

export function isInsightsLocale(value: unknown): value is InsightsLocale {
  return value === "en" || value === "ja";
}
