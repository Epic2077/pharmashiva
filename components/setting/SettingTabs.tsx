"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactElement, useState } from "react";
import { cn } from "@/lib/utils";
import AppearanceDialogue from "./AppearanceDialogue";
import LanguageDialogue from "./LanguageDialogue";

interface SettingTabsProps {
  icon: ReactElement;
  title: string;
  description?: string;
  href?: string;
  dialogue?: boolean;
  variant?: "default" | "destructive";
}

export default function SettingTabs({
  icon,
  title,
  description,
  href,
  dialogue,
  variant = "default",
}: SettingTabsProps) {
  const router = useRouter();
  const [openDialogue, setOpenDialogue] = useState(false);

  // `redirect()` throws outside of render, so client-side navigation has to go
  // through the router.
  const handleClick = () => {
    if (href) {
      router.push(href);
      return;
    }
    if (dialogue) setOpenDialogue(true);
  };

  const isInteractive = Boolean(href || dialogue);
  const destructive = variant === "destructive";

  // Which settings-editing dialogue this tab opens. Titles are matched
  // case-insensitively so "appearance"/"Appearance" both work.
  const dialogueKey = title.trim().toLowerCase();
  const dialogueNode =
    dialogueKey === "appearance" ? (
      <AppearanceDialogue open={openDialogue} onOpenChange={setOpenDialogue} />
    ) : dialogueKey === "language" ? (
      <LanguageDialogue open={openDialogue} onOpenChange={setOpenDialogue} />
    ) : null;

  return (
    <>
      <button
        type="button"
        disabled={!isInteractive}
        onClick={handleClick}
        className={cn(
          "group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isInteractive &&
            "hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
          !isInteractive && "cursor-default opacity-80",
        )}
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            destructive
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-base font-semibold",
              destructive && "text-destructive",
            )}
          >
            {title}
          </span>
          {description ? (
            <span className="block truncate text-sm text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        {href && (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {dialogue && dialogueNode}
    </>
  );
}
