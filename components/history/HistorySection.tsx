"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import AnimatedList from "@/components/react-bits/AnimatedList";
import HistoryCard from "./HistoryCard";

interface HistoryEntry {
  id: number;
  title: string;
  date: string;
  status: string;
  icon: string;
}

const history: HistoryEntry[] = [
  {
    id: 1,
    title: "Eye pain",
    date: "Today . 12:12 AM",
    status: "In Progress",
    icon: "eye",
  },
  {
    id: 2,
    title: "Stomach discomfort",
    date: "Yesterday . 10:12 PM",
    status: "Closed",
    icon: "stomach",
  },
  {
    id: 3,
    title: "Headache",
    date: "Yesterday . 08:12 PM",
    status: "Closed",
    icon: "head",
  },
  {
    id: 4,
    title: "Back pain",
    date: "Today . 09:12 AM",
    status: "Open",
    icon: "back",
  },
  {
    id: 5,
    title: "Joint pain",
    date: "Today . 11:12 AM",
    status: "In Progress",
    icon: "joint",
  },
  {
    id: 6,
    title: "Joint pain",
    date: "Today . 11:12 AM",
    status: "In Progress",
    icon: "joint",
  },
  {
    id: 7,
    title: "Joint pain",
    date: "Today . 11:12 AM",
    status: "In Progress",
    icon: "joint",
  },
];

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

export default function HistorySection() {
  const router = useRouter();

  return (
    <AnimatedList
      items={history.map((item) => ({
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
        const item = history[index];
        return (
          <div className="min-w-0 flex-1">
            <HistoryCard
              title={item.title}
              date={item.date}
              icon={item.icon}
              status={item.status}
              chatId={String(item.id)}
            />
          </div>
        );
      }}
      onItemSelect={(_item, index) =>
        router.push(`/home/chat/${history[index].id}`)
      }
    />
  );
}
