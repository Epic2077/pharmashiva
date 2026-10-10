"use client";

import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { useChatSession } from "@/lib/chat/use-chat-session";

/**
 * Wraps both /home/chat and /home/chat/[id], so the header and the composer stay
 * mounted while the page segment below them swaps. That is what makes the jump
 * from the new-chat screen into a live conversation invisible to the user.
 */
export default function ChatLayout({ children }: LayoutProps<"/home/chat">) {
  const { chat, isStreaming, send, stop } = useChatSession();

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        title={chat?.title ?? "New Consultation"}
        subtitle={
          chat ? "Consultation in progress" : "Start a new patient case"
        }
      />

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

      <footer className="shrink-0 pb-24 pt-2">
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
