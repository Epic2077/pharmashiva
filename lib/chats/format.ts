const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Format a chat's timestamp the way the history cards show it.
 *
 * Runs on the server (in the history page) so the label is computed once and
 * cannot cause a hydration mismatch in the client list.
 */
export function formatChatDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (dayDiff <= 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  if (dayDiff < 7) {
    return `${date.toLocaleDateString("en-US", { weekday: "long" })} · ${time}`;
  }
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} · ${time}`;
}

/**
 * Full, unambiguous timestamp (date + time) used as the history card tooltip.
 * Server-formatted so it cannot differ between server and client.
 */
export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
