/**
 * Database-backed product retrieval, filtering and ranking.
 *
 * The database is the only source of product facts. Flow:
 *   1. Build 1-3 search queries from the validated case facts.
 *   2. Query the catalog (existing `search_products` RPC) in parallel.
 *   3. Apply HARD constraints first (allergy exclusions).
 *   4. Rank the survivors deterministically and attach a traceable reason.
 *
 * Nothing here calls the model, and nothing here can invent a product.
 */

import { searchCatalog } from "@/lib/supabase";
import { localizeCategoryName } from "@/lib/i18n-server";
import type { LanguageCode } from "@/lib/i18n";
import type {
  CaseFacts,
  ProductCompatibility,
  ProductRecommendation,
} from "@/types/ai";
import type { ProductDetails } from "@/types/database";
import { ingredientMatchesAllergen } from "./ingredients";

const MAX_QUERIES = 3;
const PER_QUERY_LIMIT = 8;
const MAX_RESULTS = 6;

export interface ProductRetrievalResult {
  products: ProductRecommendation[];
  /** False when every catalog query failed (database unreachable). */
  databaseAvailable: boolean;
  /** Queries that were actually executed. */
  queries: string[];
}

/** Ingredient names we can compare an allergen against for a product. */
function ingredientNames(product: ProductDetails): string[] {
  return product.ingredients.flatMap((ingredient) =>
    [
      ingredient.name,
      ingredient.name_en,
      ingredient.name_fa,
      ingredient.raw_name,
    ].filter((value): value is string => Boolean(value)),
  );
}

function buildQueries(facts: CaseFacts, message: string): string[] {
  const raw = [
    ...facts.searchTerms,
    facts.goal ?? "",
    facts.category ?? "",
    message,
  ];
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const value of raw) {
    const trimmed = value.trim().replace(/\s+/g, " ");
    const key = trimmed.toLowerCase();
    if (trimmed.length < 2 || seen.has(key)) continue;
    seen.add(key);
    queries.push(trimmed.slice(0, 120));
    if (queries.length >= MAX_QUERIES) break;
  }
  return queries;
}

function buildReason(
  product: ProductDetails,
  facts: CaseFacts,
): string {
  const bits: string[] = [];
  const term = facts.searchTerms[0] ?? facts.goal ?? facts.category;
  if (term) bits.push(`Matches “${term.slice(0, 48)}”`);
  if (product.brand) bits.push(product.brand);

  const notable = product.ingredients
    .filter((ingredient) => ingredient.amount != null && ingredient.name)
    .slice(0, 2)
    .map((ingredient) => `${ingredient.name} ${ingredient.amount}${ingredient.unit ?? ""}`)
    .join(", ");
  if (notable) bits.push(`contains ${notable}`);

  return bits.join(" · ") || "Relevant to the request";
}

function scoreProduct(
  product: ProductDetails,
  rank: number,
  compatibility: ProductCompatibility,
  hasAllergyConstraint: boolean,
): number {
  let score = rank;
  if (product.ingredients.length > 0) score += 1;
  if (product.image_urls?.some((url) => url && url.trim())) score += 0.5;
  if (product.price != null) score += 0.3;
  if (product.availability === "InStock") score += 0.4;
  if (hasAllergyConstraint && compatibility === "compatible") score += 0.5;
  if (compatibility === "unknown") score -= 0.25;
  return Number(score.toFixed(3));
}

/**
 * Localize a leaf-category name without blocking the response. Translation is a
 * network call on a cold cache, so a slow translation falls back to the raw
 * stored name rather than delaying product cards.
 */
async function localizeCategorySafe(
  category: { name: string } | undefined,
  language: LanguageCode,
): Promise<string | null> {
  if (!category) return null;
  if (language === "fa") return category.name;

  try {
    return await Promise.race([
      localizeCategoryName(category, language),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(category.name), 700);
      }),
    ]);
  } catch {
    return category.name;
  }
}

export async function retrieveProducts(params: {
  facts: CaseFacts;
  message: string;
  language: LanguageCode;
  provisional: boolean;
  signal: AbortSignal;
  limit?: number;
}): Promise<ProductRetrievalResult> {
  const { facts, message, language, provisional, signal } = params;
  const limit = params.limit ?? MAX_RESULTS;

  const queries = buildQueries(facts, message);
  if (queries.length === 0) {
    return { products: [], databaseAvailable: true, queries: [] };
  }

  const settled = await Promise.allSettled(
    queries.map((query) => searchCatalog(query, PER_QUERY_LIMIT)),
  );

  const databaseAvailable = settled.some(
    (result) => result.status === "fulfilled",
  );

  // Merge hits by product id, keeping the best (highest) rank.
  const byId = new Map<
    string,
    { product: ProductDetails; rank: number }
  >();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const hit of result.value) {
      const existing = byId.get(hit.product.id);
      if (!existing || hit.rank > existing.rank) {
        byId.set(hit.product.id, { product: hit.product, rank: hit.rank });
      }
    }
  }

  const allergies = facts.allergies.filter(Boolean);
  const hasAllergyConstraint = allergies.length > 0;

  const candidates: Array<{
    product: ProductDetails;
    rank: number;
    compatibility: ProductCompatibility;
    warnings: string[];
  }> = [];

  for (const { product, rank } of byId.values()) {
    const names = ingredientNames(product);

    // Hard constraint: excluded if it contains a known allergen.
    const containsAllergen = allergies.some((allergen) =>
      ingredientMatchesAllergen(allergen, names),
    );
    if (containsAllergen) continue;

    const warnings: string[] = [];
    let compatibility: ProductCompatibility = "compatible";

    if (hasAllergyConstraint && product.ingredients.length === 0) {
      // Incomplete ingredient data means we cannot claim allergy safety.
      compatibility = "unknown";
      warnings.push(
        "Ingredient list is incomplete, so allergy compatibility cannot be confirmed.",
      );
    }

    candidates.push({ product, rank, compatibility, warnings });
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreProduct(
        candidate.product,
        candidate.rank,
        candidate.compatibility,
        hasAllergyConstraint,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const products = await Promise.all(
    ranked.map(async (candidate) => ({
      product: candidate.product,
      categoryName: await localizeCategorySafe(
        candidate.product.categories[0],
        language,
      ),
      reason: buildReason(candidate.product, facts),
      compatibility: candidate.compatibility,
      warnings: candidate.warnings,
      score: candidate.score,
      provisional,
    })),
  );

  // `signal` is accepted for symmetry; queries above are short-lived so they
  // are not individually aborted.
  void signal;

  return { products, databaseAvailable, queries };
}
