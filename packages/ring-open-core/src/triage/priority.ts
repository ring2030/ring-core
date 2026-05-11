import { collapseWhitespace, foldCompatibilityCase } from "./keywords";

export type KeywordRule = {
  /** Stable id for logging / tests (not shown to users). */
  id: string;
  /** Substrings to search (already localised by the recipe). */
  keywords: readonly string[];
  /** Higher wins on conflict. Must be within implementer-defined bounds (e.g. 1–5). */
  priority: number;
};

/**
 * Returns the highest-priority rule whose keyword appears as a substring.
 * Pure function — rules are supplied entirely by the host application / recipe.
 */
export function matchKeywordPriority(
  text: string,
  rules: readonly KeywordRule[],
  defaultPriority = 1,
): { priority: number; matchedRuleId: string | null } {
  const hay = foldCompatibilityCase(collapseWhitespace(text));
  let best: { priority: number; id: string } | null = null;
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (!kw) continue;
      const needle = foldCompatibilityCase(kw);
      if (needle && hay.includes(needle)) {
        if (!best || rule.priority > best.priority) {
          best = { priority: rule.priority, id: rule.id };
        }
      }
    }
  }
  return { priority: best?.priority ?? defaultPriority, matchedRuleId: best?.id ?? null };
}
