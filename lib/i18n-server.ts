import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  LANGUAGE_COOKIE,
  type LanguageCode,
} from "./i18n";
import { translateFaToEn } from "./translate";

/** Read the current UI language in server components and route handlers. */
export async function getServerLanguage(): Promise<LanguageCode> {
  const store = await cookies();
  const value = store.get(LANGUAGE_COOKIE)?.value;
  return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * Category names are Persian-only in the database, so English requires
 * translation (cached, keyless). Farsi uses the stored name as-is.
 */
export async function localizeCategoryName(
  category: { name: string },
  language: LanguageCode,
): Promise<string> {
  if (language === "fa") return category.name;
  return translateFaToEn(category.name);
}
