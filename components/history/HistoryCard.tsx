"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Baby,
  Bandage,
  Bone,
  Brain,
  Bug,
  Ear,
  Eye,
  HeartPulse,
  Moon,
  Pill,
  ShieldPlus,
  Smile,
  Soup,
  Stethoscope,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { ChatStatus } from "@/lib/chat/types";
import { ChatPreviewDialog } from "./ChatPreviewDialog";

interface HistoryCardProps {
  title: string;
  date: string;
  icon: string;
  status: ChatStatus;
  /** Chat id used to open the preview. Omit to disable the hold gesture. */
  chatId?: string;
  onClick?: () => void;
}

/** How long a press must be held before the preview opens. */
const HOLD_DURATION = 450;

/**
 * Icon slug → component. The slug is chosen deterministically at creation time
 * by `pickChatIcon` (lib/chat/icons.ts) and stored on the chat row.
 */
export const CHAT_ICON_COMPONENTS: Record<string, LucideIcon> = {
  general: Stethoscope,
  head: Brain,
  eye: Eye,
  ear: Ear,
  stomach: Soup,
  back: Bone,
  joint: Activity,
  heart: HeartPulse,
  skin: Bandage,
  cold: Thermometer,
  lung: Wind,
  allergy: ShieldPlus,
  sleep: Moon,
  baby: Baby,
  infection: Bug,
  medicine: Pill,
  mind: Smile,
};

const STATUS_META: Record<ChatStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/15 text-destructive" },
  in_progress: {
    label: "In Progress",
    className: "bg-primary/15 text-primary",
  },
  closed: { label: "Closed", className: "bg-chart-3/15 text-chart-3" },
};

export default function HistoryCard({
  title,
  date,
  icon,
  status,
  chatId,
  onClick,
}: HistoryCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set once a hold fired, so the click that follows the release is swallowed.
  const heldRef = useRef(false);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }

  function handlePointerDown() {
    if (!chatId) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      heldRef.current = true;
      setHolding(false);
      setPreviewOpen(true);
    }, HOLD_DURATION);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    // A completed hold already opened the preview, so swallow this click and
    // keep it from reaching the parent list row.
    if (heldRef.current) {
      heldRef.current = false;
      event.stopPropagation();
      return;
    }
    onClick?.();
  }

  const Icon = CHAT_ICON_COMPONENTS[icon] ?? Stethoscope;
  const meta = STATUS_META[status] ?? STATUS_META.open;

  return (
    <>
      <div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        // Keep the browser's long-press menu from stealing the gesture, and let
        // a vertical scroll cancel the hold mid-gesture on touch.
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          "flex select-none items-center gap-4 rounded-2xl border bg-card px-4 py-5 text-card-foreground shadow-sm transition-transform duration-150 touch-pan-y active:scale-[0.99]",
          holding && "scale-[0.98] opacity-90",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          <p className="truncate text-sm text-muted-foreground">{date}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            meta.className,
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {meta.label}
        </span>
      </div>

      {chatId ? (
        <ChatPreviewDialog
          chatId={chatId}
          title={title}
          subtitle={date}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      ) : null}
    </>
  );
}
