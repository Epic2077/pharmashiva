import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReferenceFilter } from "@/lib/medical-reference";

interface FilterOption {
  value: ReferenceFilter;
  label: string;
}

export const REFERENCE_FILTERS: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "conditions", label: "Conditions & symptoms" },
  { value: "definitions", label: "Medical definitions" },
  { value: "drugs", label: "Drugs & ingredients" },
  { value: "supplements", label: "Supplements" },
  { value: "research", label: "Research" },
];

interface ReferenceFiltersProps {
  query: string;
  active: ReferenceFilter;
}

/**
 * Search-category chips. Each chip links to the same query with a different
 * `filter` parameter; the active chip is highlighted.
 */
export function ReferenceFilters({ query, active }: ReferenceFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {REFERENCE_FILTERS.map((filter) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (filter.value !== "all") params.set("filter", filter.value);
        const qs = params.toString();
        const href = qs ? `/reference?${qs}` : "/reference";
        const isActive = filter.value === active;

        return (
          <Link
            key={filter.value}
            href={href}
            aria-pressed={isActive}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
