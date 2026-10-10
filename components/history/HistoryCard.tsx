"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { ChatPreviewDialog } from "./ChatPreviewDialog";

interface HistoryCardProps {
  title: string;
  date: string;
  icon: string;
  status: string;
  /** Chat id used to open the preview. Omit to disable the hold gesture. */
  chatId?: string;
  onClick?: () => void;
}

/** How long a press must be held before the preview opens. */
const HOLD_DURATION = 450;

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
          "bg-card text-card-foreground flex select-none items-center justify-between px-4 py-6 rounded-2xl shadow-xl transition-transform duration-150 touch-pan-y active:scale-[0.99]",
          holding && "scale-[0.98] opacity-90",
        )}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent flex justify-center items-center rounded-lg">
            {icon.split("")[0]}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{date}</p>
          </div>
        </div>
        <div
          className={cn("rounded-full px-3 py-1 text-xs font-semibold", {
            "bg-accent-foreground text-white": status === "In Progress",
            "bg-chart-3 text-white": status === "Closed",
            "bg-destructive text-white": status === "Open",
          })}
        >
          {status}
        </div>
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
