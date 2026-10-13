"use client";

import { History, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { FaHome } from "react-icons/fa";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { title: "Home", href: "/home", icon: FaHome },
  { title: "Chat", href: "/home/chat", icon: MessageCircle },
  { title: "History", href: "/home/history", icon: History },
  { title: "Search", href: "/search", icon: Search },
];

function isPathActive(pathname: string, href: string) {
  // Home is the only route that should not stay lit for its children.
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavMenu({
  variant = "mobile",
}: {
  variant?: "mobile" | "desktop";
}) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav className="hidden items-center gap-1 py-3 md:flex">
        {NAV_ITEMS.map((item) => {
          const active = isPathActive(pathname, item.href);
          return (
            <Link
              key={item.title}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="w-full shrink-0 border-t border-border bg-background py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = isPathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 text-sm transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-6" />
              <span className="text-xs font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
