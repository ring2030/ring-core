/** BCP-47 or recipe-specific locale tag (e.g. `ja-JP-japan`). */
export type LocaleTag = string;

/**
 * Map of locale tag → translated string. Host apps resolve fallbacks.
 */
export type LocalizedStringMap = Partial<Record<LocaleTag, string>> & {
  /** Preferred order when looking up missing keys. */
  fallbackChain?: readonly LocaleTag[];
};

export type LocaleBundle = {
  locale: LocaleTag;
  /** Flat key → UI string */
  strings: Record<string, string>;
};
