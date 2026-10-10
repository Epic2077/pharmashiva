import { usePathname, useRouter } from "next/navigation";
import { createChat, sendMessage, stopStreaming, useChat } from "./chat-store";

const CHAT_ROUTE = /^\/home\/chat\/([^/]+)$/;

function activeChatId(pathname: string | null) {
  const match = pathname?.match(CHAT_ROUTE);
  return match ? match[1] : null;
}

/**
 * Single source of truth for a chat screen: which chat is open (derived from the
 * URL), its state, and how to send into it. On the new-chat route there is no id
 * yet, so the first message creates the chat and navigates to its route.
 */
export function useChatSession() {
  const router = useRouter();
  const pathname = usePathname();
  const chatId = activeChatId(pathname);
  const chat = useChat(chatId);

  return {
    chatId,
    chat,
    isStreaming: chat?.streaming ?? false,
    send(prompt: string) {
      if (chatId) {
        sendMessage(chatId, prompt);
        return;
      }
      router.push(`/home/chat/${createChat(prompt)}`);
    },
    stop() {
      if (chatId) stopStreaming(chatId);
    },
  };
}
