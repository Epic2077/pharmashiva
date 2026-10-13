"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-init";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

const DEFAULT_THEME: Theme = "system";

const isTheme = (value: string | null): value is Theme =>
  value !== null && (THEMES as readonly string[]).includes(value);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function isDark(theme: Theme) {
  return theme === "dark" || (theme === "system" && systemPrefersDark());
}

/**
 * Theme preference for the whole app. The `dark` class goes on <html> because
 * globals.css declares its dark variant as `&:is(.dark *)`.
 *
 * lib/theme-init.ts already applied the stored theme before first paint, so
 * this hook only owns it from then on. Reading the preference lazily (instead
 * of in an effect) means we never briefly render — or persist — the system
 * theme before the user's choice kicks in.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      root.classList.toggle("dark", isDark(theme));
    };

    apply();
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    // "system" keeps following the OS preference until the user picks one.
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return { theme, setTheme };
}
