import AppShell from "@/components/shared/AppShell";
import { ChatLayoutShell } from "@/components/chat/ChatLayoutShell";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Wraps both /home/chat and /home/chat/[id], so the header and the composer stay
 * mounted while the page segment below them swaps. That is what makes the jump
 * from the new-chat screen into a live conversation invisible to the user.
 *
 * The chat owns its internal scrolling (messages list), so it renders inside
 * the full-height shell variant while the composer stays pinned to the bottom.
 */
export default async function ChatLayout({
  children,
}: LayoutProps<"/home/chat">) {
  const user = await getSessionUser();
  return (
    <AppShell fullHeight>
      <ChatLayoutShell user={user}>{children}</ChatLayoutShell>
    </AppShell>
  );
}
