"use client";

import { PlusCircle, Search } from "lucide-react";
import { redirect } from "next/navigation";
import Title from "../shared/Title";

export default function HistoryHeader() {
  return (
    <header className="flex items-center justify-between w-full pt-5">
      <Title title="Cases" subtitle="Your recent cases" />
      <div className="flex items-center gap-7">
        <Search className="w-7 h-7" />
        <PlusCircle
          className="w-7 h-7 "
          onClick={() => redirect("/home/chat")}
        />
      </div>
    </header>
  );
}
