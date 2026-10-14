"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { ensureChatLoaded, useChat } from "@/lib/chat/chat-store";

export default function ChatPage({ params }: PageProps<"/home/chat/[id]">) {
  const { id } = use(params);
  const router = useRouter();

  // Reading through `useChat` subscribes to the store, so once the chat has been
  // hydrated from Supabase this component re-renders on its own.
  const chat = useChat(id);
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const missing = missingFor === id;

  useEffect(() => {
    // A chat started in this tab is already in memory; only fetch when needed.
    if (chat) return;
    let cancelled = false;
    void ensureChatLoaded(id).then((ok) => {
      if (!cancelled && !ok) setMissingFor(id);
    });
    return () => {
      cancelled = true;
    };
  }, [id, chat]);

  useEffect(() => {
    if (missing) router.replace("/home/chat");
  }, [missing, router]);

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {missing ? "Returning to your chats…" : "Loading chat…"}
        </p>
      </div>
    );
  }

  return <ChatView chatId={id} />;
}
