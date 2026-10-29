/**
 * Product retrieval, filtering and ranking against the live Darukade source.
 *
 * Darukade is the only source of product facts. Flow:
 *   1. Build 1-3 search queries from the validated case facts (never the raw
 *      user sentence — that path produced irrelevant promoted products).
 *   2. Query the Darukade listing/search API in parallel.
 *   3. Fetch structured details (ingredients, specs) for the top candidates.
 *   4. Apply HARD constraints first (allergy exclusions).
 *   5. Apply the deterministic relevance gate (see ./relevance-gate.ts) so a
 *      candidate can never be shown just because the catalog returned it.
 *   6. Rank the survivors deterministically and attach a traceable reason.
 *
 * Nothing here calls the model, and nothing here can invent a product.
 * Darukade IO and category translation are injectable so the gate logic can
 * be integration-tested with mocked catalog responses.
 */

import { searchProducts, enrichProductDetails } from "@/lib/darukade/service";
import type { LanguageCode } from "@/lib/i18n";
import type {
  CaseFacts,
  ProductCompatibility,
  ProductRecommendation,
  RelevanceMatchLevel,
  RelevanceVerdict,
  RetrievalOutcomeSummary,
  ShoppingIntent,
} from "@/types/ai";
import type { ProductDetails } from "@/types/database";
import { ingredientMatchesAllergen } from "./ingredients";
import {
  deterministicQueryVariants,
  evaluateCandidateRelevance,
  hasTreatmentFormToken,
  inferShoppingIntent,
  meaningfulQueryTokens,
  symptomDomains,
} from "./relevance-gate.ts";
import { classifyProductKind } from "./product-classification";
import { productScope, scopeDecision } from "./product-scope";

const MAX_QUERIES = 3;
const PER_QUERY_LIMIT = 8;
const MAX_RESULTS = 6;

export interface RetrievalDependencies {
  /** Listing search; returns hits keyed by product id. Injectable for tests. */
  search?: (
    query: string,
    options: { limit: number; detailLimit: number },
  ) => Promise<{ hits: Array<{ product: ProductDetails; rank: number }> }>;
  /** Detail enrichment; injectable for tests. */
  enrich?: (
    products: ProductDetails[],
    options: { detailLimit: number; budgetMs: number },
  ) => Promise<{ products: ProductDetails[] }>;
  /** Leaf-category localization; injectable for tests. */
  localizeCategory?: (
    category: { name: string } | undefined,
    language: LanguageCode,
  ) => Promise<string | null>;
  /**
   * English display-name fallback for listing-only products (the source only
   * exposes `enName` on the detail page). Injecting it keeps this module
   * network-free for tests.
   */
  localizeProductName?: (
    name: string,
    language: LanguageCode,
  ) => Promise<string | null>;
}

const defaultDependencies: Required<RetrievalDependencies> = {
  search: (query, options) =>
    searchProducts(query, {
      limit: options.limit,
      detailLimit: options.detailLimit,
    }),
  enrich: (products, options) =>
    enrichProductDetails(products, options).then((result) => ({
      products: result.products,
    })),
  localizeCategory: async (category) => category?.name ?? null,
  localizeProductName: async () => null,
};

export type RetrievalOutcome = RetrievalOutcomeSummary;

export interface ProductRetrievalResult {
  products: ProductRecommendation[];
  /** False when every catalog query failed (database unreachable). */
  databaseAvailable: boolean;
  /** Queries that were actually executed. */
  queries: string[];
  /** Shopping intent derived from the case (observability). */
  scope: ShoppingIntent;
  /** Machine-readable relevance decision per candidate (logs/tests). */
  decisions: RelevanceVerdict[];
  /** True when an allergy constraint exists but ingredient data was missing. */
  missingIngredientData: boolean;
  /** True when no queryable intent existed, so nothing was searched. */
  noQueryableIntent: boolean;
  /** Structured outcome summary for diagnostics. */
  outcome: RetrievalOutcome;
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

function buildQueries(facts: CaseFacts): string[] {
  // Query sources in priority order:
  //   1. The model's `productQueries` (short product-class/ingredient phrases).
  //   2. Deterministic domain-derived product forms (bounded expansion), so a
  //      symptom still reaches the right product FORM (drops/syrup/…) when the
  //      model's queries are missing, weak or wrong — a weak AI query must
  //      never be the only thing that stands between the user and eye drops.
  //   3. `searchTerms` (the symptom phrasing) + category, as a fallback.
  // The raw user message is NEVER used as a query: sentence queries matched
  // catalog noise (e.g. promoted beauty products for "Ali's eyes are red").
  const candidates = [
    ...facts.productQueries,
    ...deterministicQueryVariants(symptomDomains(facts)),
    ...facts.searchTerms,
    facts.category ?? "",
  ];
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const value of candidates) {
    const trimmed = value.trim().replace(/\s+/g, " ");
    const key = trimmed.toLowerCase();
    if (trimmed.length < 2 || seen.has(key)) continue;
    // Reject free-form sentences: a usable query is a short phrase whose
    // meaningful tokens dominate. A sentence like "ali's eyes are red" is
    // mostly noise and must never reach the catalog as a query.
    const words = trimmed
      .split(" ")
      .filter((word) => /[\p{L}\p{N}]/u.test(word));
    if (words.length === 0 || words.length > 5) continue;
    const meaningful = meaningfulQueryTokens([trimmed]).length;
    if (meaningful === 0 || meaningful / words.length < 0.5) continue;
    seen.add(key);
    queries.push(trimmed.slice(0, 120));
    if (queries.length >= MAX_QUERIES) break;
  }
  // Last-resort fallback: when nothing above produced a query, search with the
  // raw symptom wording so a bare symptom still reaches the catalog.
  if (queries.length === 0) {
    for (const symptom of facts.symptoms) {
      const trimmed = symptom.trim().replace(/\s+/g, " ");
      const key = trimmed.toLowerCase();
      if (trimmed.length < 2 || seen.has(key)) continue;
      seen.add(key);
      queries.push(trimmed.slice(0, 120));
      if (queries.length >= MAX_QUERIES) break;
    }
  }
  return queries;
}

/** Allergy/medication notes attached to a shown candidate. */
function candidateSafetyNotes(
  product: ProductDetails,
  hasAllergyConstraint: boolean,
  hasMedications: boolean,
): {
  compatibility: ProductCompatibility;
  warnings: string[];
  missingIngredientData: boolean;
} {
  const warnings: string[] = [];
  let compatibility: ProductCompatibility = "compatible";
  let missingIngredientData = false;

  if (hasAllergyConstraint && product.ingredients.length === 0) {
    // Incomplete ingredient data means we cannot claim allergy safety.
    compatibility = "unknown";
    missingIngredientData = true;
    warnings.push(
      "Ingredient list is incomplete, so allergy compatibility cannot be confirmed.",
    );
  }

  if (hasMedications) {
    // Interaction checking requires clinical reference data the catalog does
    // not carry — say so instead of implying compatibility.
    warnings.push(
      "Interactions with the customer's current medicines have not been verified for this product — check a reliable reference before recommending.",
    );
  }

  return { compatibility, warnings, missingIngredientData };
}

function buildReason(
  product: ProductDetails,
  facts: CaseFacts,
  matchLevel: RelevanceMatchLevel,
): string {
  const bits: string[] = [];
  const term =
    facts.productQueries[0] ??
    facts.searchTerms[0] ??
    facts.goal ??
    facts.category;
  if (term) {
    // A domain-only match is a candidate, not a confirmed treatment: say so in
    // the traceable reason rather than overstating a broad category overlap.
    bits.push(
      matchLevel === "domain"
        ? `Related to “${term.slice(0, 48)}” by category area only (not a confirmed treatment)`
        : `Matches “${term.slice(0, 48)}”`,
    );
  }
  if (product.brand) bits.push(product.brand);

  const notable = product.ingredients
    .filter((ingredient) => ingredient.amount != null && ingredient.name)
    .slice(0, 3)
    .map(
      (ingredient) =>
        `${ingredient.name} ${ingredient.amount}${ingredient.unit ?? ""}`,
    )
    .join(", ");
  if (notable) bits.push(`contains ${notable}`);

  return bits.join(" · ") || "Relevant to the request";
}

function scoreProduct(
  product: ProductDetails,
  rank: number,
  compatibility: ProductCompatibility,
  hasAllergyConstraint: boolean,
  relevanceTokens: number,
  matchLevel: RelevanceMatchLevel,
  intent: ShoppingIntent,
): number {
  let score = rank;
  // Relevance tier dominates the ordering: a direct form/class/ingredient
  // match outranks a body-area (domain) match, which outranks a name-only
  // match. This keeps a broad category overlap from beating a real match.
  switch (matchLevel) {
    case "direct":
      score += 2.5 + relevanceTokens * 0.25;
      break;
    case "domain":
      score += 1.0 + relevanceTokens * 0.2;
      break;
    case "name":
      score += 0.5;
      break;
    default:
      break;
  }
  // For symptom shopping, a treatment FORM (drops/syrup/tablet) is stronger
  // evidence of suitability than a supplement class that merely shares the
  // body area: an eye drop addresses red eyes directly, an eye supplement does
  // not. Availability/image/price signals below must never outweigh this.
  if (intent === "medical_symptom") {
    if (hasTreatmentFormToken(product)) score += 1.0;
    if (classifyProductKind(product) === "supplement") score -= 0.75;
  }
  if (product.ingredients.length > 0) score += 0.6;
  if (product.image_urls?.some((url) => url && url.trim())) score += 0.3;
  if (product.price != null) score += 0.2;
  if (product.availability === "InStock") score += 0.3;
  if (hasAllergyConstraint && compatibility === "compatible") score += 0.5;
  if (compatibility === "unknown") score -= 0.25;
  return Number(score.toFixed(3));
}

export async function retrieveProducts(params: {
  facts: CaseFacts;
  message: string;
  language: LanguageCode;
  provisional: boolean;
  signal: AbortSignal;
  limit?: number;
  dependencies?: RetrievalDependencies;
}): Promise<ProductRetrievalResult> {
  const { facts, message, language, provisional, signal } = params;
  const limit = params.limit ?? MAX_RESULTS;
  const deps = { ...defaultDependencies, ...params.dependencies };

  const intent = inferShoppingIntent(facts, message);
  const queries = buildQueries(facts);
  if (queries.length === 0) {
    // Nothing queryable: return no products rather than search with noise.
    return {
      products: [],
      databaseAvailable: true,
      queries: [],
      scope: intent,
      decisions: [],
      missingIngredientData: false,
      noQueryableIntent: true,
      outcome: {
        searched: false,
        candidatesFound: 0,
        rejectedRelevance: 0,
        rejectedSafety: 0,
        rejectedCosmetic: 0,
        failedQueries: 0,
        kept: 0,
      },
    };
  }

  // Both AI-proposed and symptom-based queries start with listing-only
  // searches; structured details are fetched once for the merged candidates
  // below (bounded and deduplicated).
  const settled = await Promise.allSettled(
    queries.map((query) =>
      deps.search(query, { limit: PER_QUERY_LIMIT, detailLimit: 0 }),
    ),
  );

  const databaseAvailable = settled.some(
    (result) => result.status === "fulfilled",
  );
  const failedQueries = settled.filter(
    (result) => result.status === "rejected",
  ).length;

  // Merge hits by product id, keeping the best (highest) rank.
  const byId = new Map<string, { product: ProductDetails; rank: number }>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const hit of result.value.hits) {
      const existing = byId.get(hit.product.id);
      if (!existing || hit.rank > existing.rank) {
        byId.set(hit.product.id, { product: hit.product, rank: hit.rank });
      }
    }
  }

  const allergies = facts.allergies.filter(Boolean);
  const hasAllergyConstraint = allergies.length > 0;

  // Fetch structured details (ingredients, categories, specs) for the top
  // candidates only — bounded concurrency, timeouts and deduplication are
  // handled inside the Darukade service. Products that stay listing-only are
  // kept, but allergy compatibility is reported as unknown for them.
  const merged = [...byId.values()];
  const { products: enrichedProducts } = await deps.enrich(
    merged.map((entry) => entry.product),
    // Cover enough candidates that relevance re-ranking cannot surface an
    // unenriched card (which would fall back to the Persian source name).
    { detailLimit: 12, budgetMs: 6_500 },
  );
  const enrichedById = new Map(
    enrichedProducts.map((product) => [product.id, product]),
  );

  const queryTokens = meaningfulQueryTokens(queries);
  const domains = symptomDomains(facts);

  const candidates: Array<{
    product: ProductDetails;
    rank: number;
    compatibility: ProductCompatibility;
    warnings: string[];
    matchedTokens: string[];
    matchLevel: RelevanceMatchLevel;
  }> = [];
  const decisions: RelevanceVerdict[] = [];
  let missingIngredientData = false;
  let rejectedRelevance = 0;
  let rejectedSafety = 0;
  let rejectedCosmetic = 0;
  let rejectedScope = 0;

  for (const { product: summaryProduct, rank } of merged) {
    const product = enrichedById.get(summaryProduct.id) ?? summaryProduct;
    const names = ingredientNames(product);

    // Hard constraint: excluded if it contains a known allergen.
    const containsAllergen = allergies.some((allergen) =>
      ingredientMatchesAllergen(allergen, names),
    );
    if (containsAllergen) {
      rejectedSafety += 1;
      decisions.push({
        productId: product.id,
        pass: false,
        code: "allergy_conflict",
        reason: "Product contains an ingredient the customer is allergic to.",
        matchedTokens: [],
        matchLevel: null,
      });
      continue;
    }

    // Deterministic relevance gate: a catalog result must be justifiable
    // from the case (e.g. a brightening serum must not appear for red eyes).
    const verdict = evaluateCandidateRelevance({
      product,
      queryTokens,
      domains,
      intent,
    });
    decisions.push(verdict);
    if (!verdict.pass) {
      rejectedRelevance += 1;
      continue;
    }

    // Explicit product-scope enforcement (see ./product-scope.ts): symptom and
    // supplement shopping may surface OTC medicines (eye drops, cough syrups,
    // …) as well as supplements, but never cosmetics. Applied server-side so
    // the model can never promote a cosmetic product.
    const scopeCheck = scopeDecision(productScope(product), intent);
    if (!scopeCheck.eligible) {
      if (scopeCheck.code === "cosmetic_excluded") rejectedCosmetic += 1;
      else rejectedScope += 1;
      decisions.push({
        productId: product.id,
        pass: false,
        code: scopeCheck.code,
        reason: scopeCheck.reason,
        matchedTokens: verdict.matchedTokens,
        matchLevel: verdict.matchLevel ?? null,
      });
      continue;
    }

    const notes = candidateSafetyNotes(
      product,
      hasAllergyConstraint,
      facts.medications.length > 0,
    );
    if (notes.missingIngredientData) missingIngredientData = true;

    candidates.push({
      product,
      rank,
      compatibility: notes.compatibility,
      warnings: notes.warnings,
      matchedTokens: verdict.matchedTokens,
      matchLevel: verdict.matchLevel ?? null,
    });
  }

  // No fallback. If nothing survives the relevance gate we return an empty
  // result and the UI shows an honest empty state. Forcing a broad catalog
  // match here was the root cause of irrelevant recommendations (e.g. a
  // brightening serum for red eyes).
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreProduct(
        candidate.product,
        candidate.rank,
        candidate.compatibility,
        hasAllergyConstraint,
        candidate.matchedTokens.length,
        candidate.matchLevel,
        intent,
      ),
    }))
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    )
    .slice(0, limit);

  const products = await Promise.all(
    ranked.map(async (candidate) => {
      // The Darukade listing payload has no English name; it only exists on
      // the product detail page. If enrichment did not finish in the time
      // budget, the card would otherwise render the Persian source name even
      // in an English UI. Ask the injected, bounded localizer for a display
      // name without changing any verified catalog facts.
      const needsEnglishName = language === "en" && !candidate.product.name_en;
      const localizedName = needsEnglishName
        ? await deps.localizeProductName(candidate.product.name, language)
        : null;
      const product = localizedName
        ? { ...candidate.product, name_en: localizedName }
        : candidate.product;

      return {
        product,
        categoryName: await deps.localizeCategory(
          product.categories[0],
          language,
        ),
        reason: buildReason(product, facts, candidate.matchLevel),
        compatibility: candidate.compatibility,
        warnings: candidate.warnings,
        score: candidate.score,
        provisional,
      };
    }),
  );

  // `signal` is accepted for symmetry; queries above are short-lived so they
  // are not individually aborted.
  void signal;

  return {
    products,
    databaseAvailable,
    queries,
    scope: intent,
    decisions,
    missingIngredientData,
    noQueryableIntent: false,
    outcome: {
      searched: true,
      candidatesFound: merged.length,
      rejectedRelevance,
      rejectedSafety,
      rejectedCosmetic,
      rejectedScope,
      failedQueries,
      kept: products.length,
    },
  };
}

/** Export for the pipeline to show what queries would have been used. */
export function buildProductQueriesForFacts(facts: CaseFacts): string[] {
  return buildQueries(facts).slice(0, 3);
}
