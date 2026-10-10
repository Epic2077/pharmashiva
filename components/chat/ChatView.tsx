"use client";

import { motion } from "motion/react";
import { useChat } from "@/lib/chat/chat-store";
import { ChatMessages } from "./ChatMessages";

interface ChatViewProps {
  chatId: string;
}

export function ChatView({ chatId }: ChatViewProps) {
  const chat = useChat(chatId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full"
    >
      <ChatMessages
        messages={chat?.messages ?? []}
        isStreaming={chat?.streaming ?? false}
      />
    </motion.div>
  );
}
