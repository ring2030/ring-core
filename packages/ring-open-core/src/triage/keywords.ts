/**
 * Locale-agnostic string normalisation for keyword matching.
 * Callers supply language-specific keywords; this module only normalises text.
 */
export function foldCompatibilityCase(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
