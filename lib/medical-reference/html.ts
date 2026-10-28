/**
 * Tiny HTML/entity helpers for cleaning source-provided markup.
 *
 * MedlinePlus returns summaries and titles as HTML (sometimes with <span
 * class="qt0">…</span> search highlighting). We only ever want the visible text
 * and never render source HTML, so this strips tags and decodes entities.
 */

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCodePoint(Number(dec)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Strip HTML tags and turn block boundaries into line breaks. */
export function stripHtml(html: string): string {
  if (!html) return "";
  const withoutTags = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(?:p|div|li|tr|section|ul|ol|table|h[1-6])\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Truncate to a character budget on a word boundary, appending an ellipsis. */
export function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max / 2 ? lastSpace : max).trimEnd()}…`;
}
