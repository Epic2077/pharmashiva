"use client";

import { useCallback, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "fa", label: "Farsi", native: "فارسی" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "pharmashiva-language";
const DEFAULT_LANGUAGE: LanguageCode = "en";

const isLanguageCode = (value: string | null): value is LanguageCode =>
  value !== null && LANGUAGES.some((language) => language.code === value);

function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
}

/** Persisted language choice; the UI copy itself still ships in English. */
export function useLanguage() {
  // Lazy read, see useTheme: the value only ever reaches localStorage and
  // effects, never the server-rendered markup, so there is no hydration
  // mismatch and no flicker of the default.
  const [language, setLanguageState] =
    useState<LanguageCode>(readStoredLanguage);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { language, setLanguage };
}
