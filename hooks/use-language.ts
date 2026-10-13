"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  LANGUAGE_COOKIE,
  type LanguageCode,
} from "@/lib/i18n";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "fa", label: "Farsi", native: "فارسی" },
] as const;

export type { LanguageCode };

const STORAGE_KEY = "pharmashiva-language";

function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
}

/**
 * Persisted language choice. Mirrors the value into a cookie so server
 * components can render product/category names in the right language.
 */
export function useLanguage() {
  // Lazy read, see useTheme: the value only ever reaches localStorage and
  // effects, never the server-rendered markup, so there is no hydration
  // mismatch and no flicker of the default.
  const [language, setLanguageState] =
    useState<LanguageCode>(readStoredLanguage);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000`;
  }, []);

  return { language, setLanguage };
}
