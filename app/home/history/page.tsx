import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryHeader from "@/components/history/HistoryHeader";
import HistorySection, {
  type HistoryEntry,
} from "@/components/history/HistorySection";
import { getSessionUser } from "@/lib/auth/session";
import { listChats } from "@/lib/chats/db";
import { formatChatDate, formatChatTimestamp } from "@/lib/chats/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getSessionUser();

  let entries: HistoryEntry[] = [];
  if (user) {
    try {
      const chats = await listChats(user.id);
      entries = chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        icon: chat.icon,
        status: chat.status,
        date: formatChatDate(chat.updatedAt),
        timestamp: formatChatTimestamp(chat.updatedAt),
      }));
    } catch (error) {
      console.error("[history] could not load chats:", error);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <HistoryHeader />
      <HistoryFilters />
      <HistorySection entries={entries} />
    </div>
  );
}
