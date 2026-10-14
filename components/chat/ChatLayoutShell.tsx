"use client";

import type { ReactNode } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHeader } from "@/components/chat/ChatHeader";
import type { ProfileNavUser } from "@/components/shared/ProfileNav";
import { useChatSession } from "@/lib/chat/use-chat-session";

/**
 * Client half of the chat layout. Split out so the server layout can resolve
 * the signed-in user and hand it down, while the header and composer stay
 * mounted across the /home/chat ↔ /home/chat/[id] navigation.
 */
export function ChatLayoutShell({
  user,
  children,
}: {
  user: ProfileNavUser | null;
  children: ReactNode;
}) {
  const { chatId, chat, isStreaming, send, stop, error } = useChatSession();

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        title={chat?.title ?? (chatId ? "Consultation" : "New Consultation")}
        subtitle={
          chat ? "Consultation in progress" : "Start a new patient case"
        }
        user={user}
      />

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

      <footer className="shrink-0 pt-2">
        {error ? (
          <p role="alert" className="pb-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <ChatComposer
          placeholder={
            chat ? "Reply to Shiva..." : "Describe the patient case..."
          }
          isStreaming={isStreaming}
          onSubmit={send}
          onStop={stop}
        />
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Shiva can make mistakes. Always verify medical information.
        </p>
      </footer>
    </div>
  );
}
