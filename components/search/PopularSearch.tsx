import Link from "next/link";
import { TrendingUp } from "lucide-react";

interface PopularSearchProps {
  searches: string[];
}

export default function PopularSearch({ searches }: PopularSearchProps) {
  if (searches.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Popular Searches</h3>
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
