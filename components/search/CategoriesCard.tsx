import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

interface CategoriesCardProps {
  icon: ReactElement;
  title: string;
  count: number;
  href: string;
}

export default function CategoriesCard({
  icon,
  title,
  count,
  href,
}: CategoriesCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all motion-reduce:transition-none hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">
          {count > 0 ? `${count} subcategories` : "Browse products"}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}
