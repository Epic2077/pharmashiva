"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pharmashiva-recent-searches";
const CHANGE_EVENT = "pharmashiva-recent-searches-change";

const EMPTY: string[] = [];

/** Cache so the same underlying value always maps to the same snapshot. */
let cachedRaw: string | null = null;
let cachedSnapshot: string[] = EMPTY;

function parseRecentSearches(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, 5);
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(callback: () => void) {
  // `storage` covers cross-tab writes; the custom event covers same-tab
  // writes from `addRecentSearch`.
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/**
 * Snapshot of the recent searches. The result is cached: the same raw
 * localStorage value always returns the same array reference, which
 * `useSyncExternalStore` requires to avoid an infinite render loop.
 */
function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = raw ? parseRecentSearches(raw) : EMPTY;
  return cachedSnapshot;
}

export default function RecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  if (searches.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <Clock className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Recent Searches</h3>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {searches.map((search) => (
          <Link
            key={search}
            href={`/search?q=${encodeURIComponent(search)}`}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            {search}
          </Link>
        ))}
      </div>
    </div>
  );
}
