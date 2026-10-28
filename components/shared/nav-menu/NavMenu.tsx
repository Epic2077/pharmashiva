"use client";

import { BookOpen, History, MessageCircle, Search } from "lucide-react";
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

export const NAV_ITEMS: NavItem[] = [
  { title: "Home", href: "/home", icon: FaHome },
  { title: "Chat", href: "/home/chat", icon: MessageCircle },
  { title: "History", href: "/home/history", icon: History },
  { title: "Search", href: "/search", icon: Search },
  { title: "Reference", href: "/reference", icon: BookOpen },
];

export function isPathActive(pathname: string, href: string) {
  // Home is the only route that should not stay lit for its children.
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Vertical navigation for the desktop sidebar. Rendered inside the sidebar, so
 * it carries no breakpoint of its own.
 */
export function SidebarNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isPathActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.title}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile/tablet bottom tab bar. Hidden from `lg` up, where the sidebar takes
 * over navigation.
 */
export default function NavMenu() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="w-full shrink-0 border-t border-border bg-background py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
    >
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

