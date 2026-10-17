"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pharmashiva-recent-searches";

export default function RecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          setSearches(parsed.slice(0, 5));
        }
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error);
    }
  }, []);

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
