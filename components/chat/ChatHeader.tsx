"use client";

import { useRouter } from "next/navigation";
import ProfileNav from "../shared/ProfileNav";
import BackLink from "../shared/BackLink";

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
}

export function ChatHeader({ title, subtitle }: ChatHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex shrink-0 items-center gap-4 py-3 justify-between">
      <BackLink title={title} subtitle={subtitle} />
      <ProfileNav isLoggedIn={true} />
    </header>
  );
}
