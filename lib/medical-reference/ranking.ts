/**
 * Deterministic result ranking for the unified medical search.
 *
 * Ranking is intentionally simple and explainable: patient-facing sources rank
 * higher for general queries, and title/summary token overlap with the query
 * pushes a record up. It never interprets a match as clinical endorsement.
 */

import type { MedicalReference, MedicalSource } from "./types";
import { normalizeQuery } from "./normalization";

const SOURCE_WEIGHT: Record<MedicalSource, number> = {
  medlineplus: 10,
  dailymed: 9,
  rxnorm: 7,
  pubchem: 7,
  pubmed: 6,
};

export function rankReferences(
  references: MedicalReference[],
  query: string,
): MedicalReference[] {
  const q = normalizeQuery(query);
  const terms = q
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  const scored = references.map((ref) => {
    const haystack = normalizeQuery(`${ref.title} ${ref.summary ?? ""}`);
    let score = SOURCE_WEIGHT[ref.source] ?? 5;

    let overlap = 0;
    for (const term of terms) {
      if (haystack.includes(term)) overlap += 1;
    }
    score += overlap * 3;

    if (normalizeQuery(ref.title).startsWith(q)) score += 4;

    return { ref, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.ref);
}
