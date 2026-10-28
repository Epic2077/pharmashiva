import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import NavMenu, { SidebarNav } from "./nav-menu/NavMenu";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  /** Wider content column for listing pages (search, categories). */
  wide?: boolean;
  /** Pages that own their internal scrolling (chat) and need full height. */
  fullHeight?: boolean;
}

/**
 * Shared application shell.
 *
 * Mobile/tablet (`< lg`): full-width content plus the bottom tab bar, exactly
 * as before. Desktop (`lg`+): a fixed brand sidebar with vertical navigation,
 * and a centered, readable content column so nothing stretches edge-to-edge on
 * a wide monitor.
 */
export default function AppShell({
  children,
  wide = false,
  fullHeight = false,
}: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/40 px-4 py-6 lg:flex">
        <Link
          href="/home"
          className="flex items-center gap-2.5 px-1.5"
          aria-label="PharmaShiva home"
        >
          <Image
            src="/logo/logo.svg"
            alt="PharmaShiva logo"
            width={38}
            height={40}
            priority
            className="shrink-0"
          />
          <span className="truncate text-lg font-bold tracking-tight text-primary">
            PharmaShiva
          </span>
        </Link>

        <SidebarNav className="mt-8 flex-1" />

        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/70">
          Shiva can make mistakes. Always verify medical information.
        </p>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {fullHeight ? (
          <div className="min-h-0 flex-1">
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-3 sm:px-5 md:px-6">
              {children}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                "mx-auto w-full px-5 py-4 md:px-8 md:py-7",
                wide ? "max-w-5xl" : "max-w-3xl",
              )}
            >
              {children}
            </div>
          </div>
        )}

        <NavMenu />
      </div>
    </div>
  );
}
