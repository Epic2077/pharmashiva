"use client";

import { motion } from "motion/react";
import type { Message } from "@/lib/chat/types";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import Logo from "@/components/shared/Logo";
import { TypingIndicator } from "./TypingIndicator";

interface AssistantMessageProps {
  message: Message;
  isStreaming: boolean;
}

export function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  const isEmpty = message.content.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="text-bases leading-relaxed wrap-break-words text-foreground mt-5"
    >
      <div className="flex flex-col gap-2 text-left">
        {/* self-start keeps the logo left-aligned without shrinking the text */}
        <Logo size="small" className="self-start floating-component" />
        {isEmpty && isStreaming ? (
          <TypingIndicator />
        ) : (
          <>
            <MarkdownRenderer>{message.content}</MarkdownRenderer>
            {isStreaming ? (
              <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle" />
            ) : null}
          </>
        )}
      </div>
    </motion.div>
  );
}
