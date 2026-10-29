/**
 * Candidate pooling for the two-stage retrieval pipeline.
 *
 * Early retrieval (symptom-driven, instant) and refined retrieval (AI-query
 * driven) each return their own ranked recommendation lists. This module
 * combines them so a refined result never *replaces* an early result merely
 * because it returned something: the two lists are merged by stable product id
 * and re-ranked deterministically, so the better-scoring entry wins on
 * evidence, not on which stage produced it.
 *
 * Pure and network-free, so the pooling and ordering behaviour is unit-testable.
 */

import type { ProductRecommendation } from "@/types/ai";

/**
 * Merge two ranked recommendation lists, deduping by product id (keeping the
 * higher-scoring entry for each id) and re-ranking the combined set by score,
 * then a stable id tiebreak for determinism. `primary` (early) and `secondary`
 * (refined) are otherwise treated symmetrically.
 */
export function poolProductRecommendations(
  primary: ProductRecommendation[],
  secondary: ProductRecommendation[],
  limit: number,
): ProductRecommendation[] {
  const byId = new Map<string, ProductRecommendation>();
  for (const item of [...primary, ...secondary]) {
    const existing = byId.get(item.product.id);
    if (!existing || item.score > existing.score) {
      byId.set(item.product.id, item);
    }
  }
  return [...byId.values()]
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    )
    .slice(0, limit);
}
