import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavigationButtonProps {
  id: string;
  name: string;
  sub: string;
  href: string;
  icon: ReactNode;
}

export default function NavigationButton({
  item,
}: {
  item: NavigationButtonProps;
}) {
  const featured = item.id === "new-consultation";

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center justify-between gap-4 rounded-2xl p-5 transition-all motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.99]",
        featured
          ? "bg-[url('/texture/texture-green.png')] bg-cover bg-center shadow-lg"
          : "border bg-card shadow-sm hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            featured
              ? "bg-white/10 text-white ring-1 ring-white/25"
              : "bg-primary/10 text-primary",
          )}
        >
          {item.icon}
        </span>
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate text-lg font-bold",
              featured ? "text-white" : "text-foreground",
            )}
          >
            {item.name}
          </h3>
          <p
            className={cn(
              "truncate text-sm",
              featured ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {item.sub}
          </p>
        </div>
      </div>
      <ChevronRight
        className={cn(
          "size-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none",
          featured ? "text-white/70" : "text-muted-foreground",
        )}
      />
    </Link>
  );
}
