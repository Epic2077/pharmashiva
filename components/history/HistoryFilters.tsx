"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const filters = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

export default function HistoryFilters() {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div
      role="radiogroup"
      aria-label="Filter consultations"
      className="flex w-full items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      {filters.map((filter) => {
        const active = activeFilter === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setActiveFilter(filter.value)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
