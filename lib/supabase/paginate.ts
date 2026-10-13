import type { PostgrestError } from "@supabase/supabase-js";

/** PostgREST caps responses at 1000 rows per request. */
const PAGE_SIZE = 1000;
/** Keep `.in(...)` id lists short so query URLs stay safe. */
export const IN_CHUNK = 300;

interface RawPage {
  data: unknown;
  error: PostgrestError | null;
}

type RawQuery = PromiseLike<RawPage>;

/**
 * Page through `.range()` until a short page comes back, so queries over
 * tables bigger than 1000 rows (product_categories, product_ingredients, …)
 * are never silently truncated.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => RawQuery,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Run `.in(column, ids)` queries in small chunks (keeps URLs short) and page
 * through each chunk's rows when they exceed 1000.
 */
export async function fetchByIn<T>(
  ids: string[],
  query: (chunk: string[], from: number, to: number) => RawQuery,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await query(chunk, from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as T[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}
