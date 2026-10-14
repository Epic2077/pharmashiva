"use client";

import ProfileNav, { type ProfileNavUser } from "../shared/ProfileNav";
import BackLink from "../shared/BackLink";

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  user?: ProfileNavUser | null;
}

export function ChatHeader({ title, subtitle, user }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-4 py-3 justify-between">
      <BackLink title={title} subtitle={subtitle} />
      <ProfileNav isLoggedIn={Boolean(user)} user={user} />
    </header>
  );
}
