"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/chat/types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
}

const STICK_DISTANCE = 96;

/**
 * Once a later safety assessment blocks or restricts recommendations, product
 * cards from earlier turns are no longer appropriate and are withheld in the
 * transcript. This keeps the visible case consistent with the latest backend
 * state.
 */
function withEscalationSuppression(messages: Message[]): Message[] {
  let escalated = false;
  const out: Message[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") {
      const permission = message.safety?.recommendationPermission;
      if (permission === "blocked" || permission === "restricted") {
        escalated = true;
      }
      if (escalated && message.products && message.products.length > 0) {
        out.unshift({
          ...message,
          productsSuppressed: true,
          productsGateReason:
            "Earlier product suggestions are withheld because a safety concern was raised later in this conversation.",
        });
        continue;
      }
    }
    out.unshift(message);
  }
  return out;
}

export function ChatMessages({ messages, isStreaming }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : undefined;
  const displayMessages = withEscalationSuppression(messages);

  // Keep the newest message in view, unless the reader scrolled up.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !stickToBottom) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, stickToBottom]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setStickToBottom(distanceFromBottom < STICK_DISTANCE);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto overscroll-contain px-1 py-4"
    >
      <div className="flex flex-col gap-4">
        {displayMessages.map((message) =>
          message.role === "user" ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              isStreaming={isStreaming && message.id === lastMessage?.id}
            />
          ),
        )}
      </div>
    </div>
  );
}
