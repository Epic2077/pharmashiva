import { ChatLayoutShell } from "@/components/chat/ChatLayoutShell";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Wraps both /home/chat and /home/chat/[id], so the header and the composer stay
 * mounted while the page segment below them swaps. That is what makes the jump
 * from the new-chat screen into a live conversation invisible to the user.
 *
 * This stays a server component so it can resolve the current user once; the
 * interactive chrome lives in ChatLayoutShell.
 */
export default async function ChatLayout({
  children,
}: LayoutProps<"/home/chat">) {
  const user = await getSessionUser();
  return <ChatLayoutShell user={user}>{children}</ChatLayoutShell>;
}
