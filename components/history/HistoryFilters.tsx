"use client";

import { useState } from "react";
import JellyRadio, { type JellyRadioItem } from "@/components/react-bits/JellyRadio";

const filters: JellyRadioItem[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

export default function HistoryFilters() {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <JellyRadio
      items={filters}
      value={activeFilter}
      onChange={(value) => setActiveFilter(value)}
      ariaLabel="Filter consultations"
      size="lg"
      gap={8}
      radius={22}
      chipColor="var(--card)"
      activeColor="var(--primary)"
      textColor="var(--foreground)"
      activeTextColor="var(--primary-foreground)"
      className="w-full justify-between"
    />
  );
}
