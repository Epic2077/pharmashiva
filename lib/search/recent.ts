const STORAGE_KEY = "pharmashiva-recent-searches";
const CHANGE_EVENT = "pharmashiva-recent-searches-change";
const MAX_RECENT = 5;

/** Add a query to recent searches (client-side only). */
export function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const filtered = list.filter(
      (q) => q.toLowerCase() !== trimmed.toLowerCase(),
    );
    filtered.unshift(trimmed);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENT)),
    );
    // Same-tab notification for useSyncExternalStore subscribers
    // (`storage` events only fire for other tabs).
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (error) {
    console.error("Failed to save recent search:", error);
  }
}
