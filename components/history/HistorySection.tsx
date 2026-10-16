"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import AnimatedList from "@/components/react-bits/AnimatedList";
import type { ChatStatus } from "@/lib/chat/types";
import HistoryCard from "./HistoryCard";

export interface HistoryEntry {
  id: string;
  title: string;
  /** Preformatted on the server so the list renders identically everywhere. */
  date: string;
  /** Full date+time for the exact-time tooltip. */
  timestamp: string;
  status: ChatStatus;
  icon: string;
}

/**
 * AnimatedList is used for its reveal-on-scroll animation only, so every chrome
 * token it paints (row background, shadow, rim, selection ring, hover/active
 * filters) is switched off and the cards keep their existing design.
 */
const plainRowStyle = {
  "--al-tile": "transparent",
  "--al-tile-shadow": "none",
  "--al-tile-edge": "transparent",
  "--al-tile-highlight": "transparent",
  "--al-active": "none",
  "--al-hover": "none",
  "--al-ring": "transparent",
  "--al-ring-fill": "transparent",
} as CSSProperties;

export default function HistorySection({
  entries,
}: {
  entries: HistoryEntry[];
}) {
  const router = useRouter();

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No cases yet. Start a consultation and it will show up here.
      </p>
    );
  }

  return (
    <AnimatedList
      items={entries.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.date,
        meta: item.status,
      }))}
      // Rows are plain wrappers; the card itself owns the layout.
      itemClassName="p-0!"
      style={plainRowStyle}
      frame={false}
      showGradients={false}
      displayScrollbar={false}
      selectOnHover={false}
      enableArrowNavigation={false}
      animation="pop"
      gap={16}
      radius={0}
      width="100%"
      maxHeight="calc(100dvh - 16rem)"
      renderItem={(_item, index) => {
        const item = entries[index];
        return (
          <div className="min-w-0 flex-1">
            <HistoryCard
              title={item.title}
              date={item.date}
              timestamp={item.timestamp}
              icon={item.icon}
              status={item.status}
              chatId={item.id}
              onChanged={() => router.refresh()}
            />
          </div>
        );
      }}
      onItemSelect={(_item, index) =>
        router.push(`/home/chat/${entries[index].id}`)
      }
    />
  );
}
