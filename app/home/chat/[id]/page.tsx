"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { getChat } from "@/lib/chat/chat-store";

export default function ChatPage({ params }: PageProps<"/home/chat/[id]">) {
  const { id } = use(params);

  // Chats only live in memory for now, so an unknown id means a stale link.
  if (!getChat(id)) redirect("/home/chat");

  return <ChatView chatId={id} />;
}
