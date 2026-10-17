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

const LATIN_ONLY = /^[\x00-\x7F\s]*$/;

/**
 * Persian → English with a hard fallback to the original text, so a slow or
 * failing translation service never blocks a page. Already-Latin titles are
 * returned unchanged.
 */
export async function translateFaToEnBounded(
  text: string,
  timeoutMs = 3_000,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || LATIN_ONLY.test(trimmed)) return trimmed;
  try {
    return await Promise.race([
      translateFaToEn(trimmed),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(trimmed), timeoutMs);
      }),
    ]);
  } catch {
    return trimmed;
  }
}

/**
 * Translate a batch of category titles with bounded concurrency, per-item
 * timeouts and an overall budget. Untranslated items fall back to their
 * Persian title instead of blocking. Results come from the shared translation
 * cache, so repeat calls are fast.
 */
export async function localizeTitlesBounded(
  titles: readonly string[],
  language: LanguageCode,
  options: {
    budgetMs?: number;
    timeoutMs?: number;
    concurrency?: number;
  } = {},
): Promise<string[]> {
  if (language === "fa") return titles.map((title) => title);
  const budgetMs = options.budgetMs ?? 4_000;
  const timeoutMs = options.timeoutMs ?? 3_000;
  const concurrency = Math.max(1, options.concurrency ?? 4);

  const unique = [...new Set(titles.filter((title) => title.trim()))];
  const labels = new Map<string, string>();
  const startedAt = Date.now();
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < unique.length) {
      const title = unique[cursor]!;
      cursor += 1;
      const remaining = budgetMs - (Date.now() - startedAt);
      if (remaining <= 50) {
        labels.set(title, title);
        continue;
      }
      labels.set(
        title,
        await translateFaToEnBounded(title, Math.min(timeoutMs, remaining)),
      );
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () =>
      worker(),
    ),
  );
  return titles.map((title) => labels.get(title) ?? title);
}
