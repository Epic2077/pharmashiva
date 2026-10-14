import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createChat,
  sendMessage,
  stopStreaming,
  useChat,
  type SendOptions,
} from "./chat-store";

const CHAT_ROUTE = /^\/home\/chat\/([^/]+)$/;

function activeChatId(pathname: string | null) {
  const match = pathname?.match(CHAT_ROUTE);
  return match ? match[1] : null;
}

/**
 * Single source of truth for a chat screen: which chat is open (derived from the
 * URL), its state, and how to send into it. On the new-chat route there is no id
 * yet, so the first message creates the chat (in Supabase) and navigates to it.
 */
export function useChatSession() {
  const router = useRouter();
  const pathname = usePathname();
  const chatId = activeChatId(pathname);
  const chat = useChat(chatId);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    chatId,
    chat,
    error,
    isStreaming: (chat?.streaming ?? false) || starting,
    async send(prompt: string, options: SendOptions = {}) {
      setError(null);

      if (chatId) {
        sendMessage(chatId, prompt, options);
        return;
      }

      // No chat yet: create it, then swap the route to its id. The layout stays
      // mounted, so the header/composer never remount.
      if (starting) return;
      setStarting(true);
      try {
        const id = await createChat(prompt, options);
        router.push(`/home/chat/${id}`);
      } catch (cause) {
        console.error("Could not start the chat:", cause);
        setError(
          "Couldn't start a new consultation. Please check your connection and try again.",
        );
      } finally {
        setStarting(false);
      }
    },
    stop() {
      if (chatId) stopStreaming(chatId);
    },
  };
}
