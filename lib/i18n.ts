/**
 * Pure i18n helpers — safe to import from both server and client code.
 * Keeps the language type and name-picking logic in one place.
 */

export type LanguageCode = "en" | "fa";

export const LANGUAGE_COOKIE = "pharmashiva-language";
export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(
  value: string | null | undefined,
): value is LanguageCode {
  return value === "en" || value === "fa";
}

export interface LocalizedText {
  /** Source display name (Persian on darukade). */
  name: string;
  name_en?: string | null;
  name_fa?: string | null;
}

/**
 * Pick the display name for a language. English is the default; Farsi is used
 * only when the app is in Farsi. Falls back to the source name when the chosen
 * language's name is missing.
 */
export function localizedName(
  text: LocalizedText,
  language: LanguageCode,
): string {
  if (language === "fa") return text.name_fa || text.name;
  return text.name_en || text.name;
}
