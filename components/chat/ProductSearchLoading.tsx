"use client";

import { PackageSearch } from "lucide-react";

/**
 * Placeholder shown while the catalog lookup is in flight.
 *
 * Catalog search can take several seconds, so the user sees an animated
 * skeleton in the exact spot where product cards will appear, instead of a
 * silent gap that looks like the app has stalled.
 */
export function ProductSearchLoading() {
  return (
    <section
      className="my-3"
      aria-live="polite"
      aria-busy="true"
      aria-label="Searching the catalog for products"
    >
      <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-primary">
        <PackageSearch
          size={16}
          className="animate-pulse"
          aria-hidden="true"
        />
        <span>Searching the catalog…</span>
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="flex animate-pulse gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:gap-3.5 sm:p-4"
          >
            <div className="size-20 shrink-0 self-start rounded-xl border border-border/70 bg-muted sm:size-24" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
              <div className="h-3.5 w-3/4 rounded-full bg-muted" />
              <div className="h-3 w-1/3 rounded-full bg-muted" />
              <div className="mt-1 h-4 w-24 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
