"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

interface CategoryResult {
  id: string;
  title: string;
  parent: string | null;
}

const DEBOUNCE_MS = 250;

export default function CategorySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    const controller = new AbortController();

    const id = setTimeout(async () => {
      if (!trimmed) {
        requestIdRef.current += 1;
        setResults([]);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);

      try {
        const response = await fetch(
          `/api/categories?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          categories?: CategoryResult[];
        };
        if (requestIdRef.current === requestId) {
          setResults(data.categories ?? []);
        }
      } catch {
        // aborted or failed — keep the previous results
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [trimmed]);

  return (
    <div className="flex flex-col gap-3">
      <InputGroup className="h-12 rounded-2xl">
        <InputGroupAddon align="inline-start" className="pl-3.5">
          <Search className="size-5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories…"
        />
      </InputGroup>

      {trimmed ? (
        <div className="flex flex-col gap-2">
          {loading && results.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
              No categories found.
            </p>
          ) : (
            results.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.id}`}
                className="group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {category.title}
                  </span>
                  {category.parent ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {category.parent}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
