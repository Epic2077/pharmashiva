/**
 * Query normalization and filter routing for the Medical Reference search.
 *
 * Whitespace, case and Persian/Arabic character drift are normalized with the
 * same text utility the safety engine uses, so "سردرد" and a Persian keyboard
 * variant of the same word behave identically.
 */

import { normaliseHealthText } from "@/lib/safety/text";
import type { ReferenceFilter } from "./types";

/** Normalize a free-text query for matching and source requests. */
export function normalizeQuery(query: string): string {
  return normaliseHealthText(query).replace(/\s+/g, " ").trim();
}

export function isReferenceFilter(
  value: string | null | undefined,
): value is ReferenceFilter {
  return (
    value === "all" ||
    value === "conditions" ||
    value === "definitions" ||
    value === "drugs" ||
    value === "supplements" ||
    value === "research"
  );
}

/** True when the query contains Persian/Arabic script (needs translation). */
export function isPersianScript(query: string): boolean {
  return /[\u0600-\u06ff]/.test(query);
}
