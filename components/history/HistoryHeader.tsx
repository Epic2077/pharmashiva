"use client";

import { PlusCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Title from "../shared/Title";

export default function HistoryHeader() {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between w-full pt-5">
      <Title title="Cases" subtitle="Your recent cases" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Search cases"
          className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-6" />
        </button>
        <button
          type="button"
          aria-label="New case"
          onClick={() => router.push("/home/chat")}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <PlusCircle className="size-6" />
        </button>
      </div>
    </header>
  );
}
