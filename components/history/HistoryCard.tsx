"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Baby,
  Bandage,
  Bone,
  Brain,
  Bug,
  Check,
  Ear,
  Eye,
  HeartPulse,
  Moon,
  MoreVertical,
  Pill,
  ShieldPlus,
  Smile,
  Soup,
  Stethoscope,
  Thermometer,
  Trash2,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { ChatStatus } from "@/lib/chat/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatPreviewDialog } from "./ChatPreviewDialog";

interface HistoryCardProps {
  title: string;
  date: string;
  /** Full date+time, exposed as a tooltip for the exact conversation time. */
  timestamp?: string;
  icon: string;
  status: ChatStatus;
  /** Chat id used to open the preview. Omit to disable the hold gesture. */
  chatId?: string;
  onClick?: () => void;
  /** Called after a successful status change or delete, so the list refreshes. */
  onChanged?: () => void;
}

/** How long a press must be held before the preview opens. */
const HOLD_DURATION = 450;

const STATUS_OPTIONS: ReadonlyArray<{ value: ChatStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

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
  timestamp,
  icon,
  status,
  chatId,
  onClick,
  onChanged,
}: HistoryCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
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

  /** Persist a status change or deletion, then ask the list to refresh. */
  async function mutate(options: { method: "PATCH" | "DELETE"; body?: string }) {
    if (!chatId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: options.method,
        headers: { "Content-Type": "application/json" },
        body: options.body,
      });
      if (!response.ok) throw new Error(`${response.status}`);
      onChanged?.();
    } catch (error) {
      console.error("[history] conversation action failed:", error);
    } finally {
      setBusy(false);
    }
  }

  function handleStatusChange(next: ChatStatus) {
    if (next === status) return;
    void mutate({ method: "PATCH", body: JSON.stringify({ status: next }) });
  }

  function handleDelete() {
    if (!chatId) return;
    const confirmed = window.confirm(
      "Delete this conversation? This cannot be undone.",
    );
    if (!confirmed) return;
    void mutate({ method: "DELETE" });
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
          busy && "opacity-60",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          <p
            className="truncate text-sm text-muted-foreground"
            title={timestamp || undefined}
          >
            {date}
          </p>
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

        {/* Actions menu. Stopping pointer/click here keeps the card's
            hold-to-preview and navigate handlers from firing while the menu
            is used. */}
        {chatId ? (
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Conversation actions"
                disabled={busy}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-44 rounded-xl p-1.5"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className="gap-2 py-2"
                      onClick={() => handleStatusChange(option.value)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          option.value === status ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <span>{option.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="gap-2 py-2"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
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
