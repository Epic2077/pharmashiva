/**
 * Runtime Darukade service for live product retrieval.
 * Server-side only. Uses direct Darukade APIs as per DATABASE_USAGE.md.
 *
 * Pipeline:
 *   1. Listing API for discovery (`/products?w=…`, category requests).
 *   2. Category labels come from the source's own navigation tree.
 *   3. Structured details (ingredients, specs, variants) are fetched
 *      selectively, with bounded concurrency, timeouts, deduplication and a
 *      short in-memory cache.
 *   4. Nothing here depends on the retired SiteHarvest catalog tables.
 */

import { DarukadeClient, type ListingQuery } from "./client";
import { sleep } from "./http";
import type { ListingPage } from "./normalize";
import type {
  NormalizedProductDetail,
  NormalizedProductSummary,
} from "./types";
import {
  getCategoryTree,
  getCachedCategoryTree,
  findCategoryForProductUrl,
  findCategoryNodeById,
  requestForCategoryNode,
  warmCategoryTreeFromPageProps,
} from "./categories";
import type {
  Availability,
  CategoryRef,
  IngredientRef,
  ProductDetails,
  ProductProperty,
  ProductSearchHit,
  ProductVariant,
} from "@/types/database";

const client = new DarukadeClient();

/* ── Short-lived caches ────────────────────────────────────────── */

/** product id -> canonical URL, learned from listings (so `/search/products/{id}` resolves). */
const productUrlById = new Map<string, { url: string; ts: number }>();
const URL_MAP_TTL_MS = 60 * 60 * 1000;
const URL_MAP_MAX = 1000;

/** Full-page details keyed by canonical URL. */
const detailCache = new Map<string, { product: ProductDetails; ts: number }>();
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_MAX = 250;

/** In-flight detail fetches, so concurrent calls share one request. */
const inflightDetails = new Map<string, Promise<ProductDetails | null>>();

function trimCache<K, V>(map: Map<K, V>, max: number): void {
  if (map.size <= max) return;
  const overflow = map.size - max;
  const keys = map.keys();
  for (let i = 0; i < overflow; i += 1) {
    const key = keys.next().value as K | undefined;
    if (key === undefined) break;
    map.delete(key);
  }
}

function rememberListing(listing: ListingPage): void {
  const now = Date.now();
  for (const product of listing.products) {
    if (!product.productUrl) continue;
    productUrlById.set(String(product.sourceProductId), {
      url: product.productUrl,
      ts: now,
    });
  }
  trimCache(productUrlById, URL_MAP_MAX);
}

function rememberedUrl(id: string): string | null {
  const entry = productUrlById.get(id);
  if (!entry) return null;
  if (Date.now() - entry.ts > URL_MAP_TTL_MS) {
    productUrlById.delete(id);
    return null;
  }
  return entry.url;
}

/* ── Availability ───────────────────────────────────────────────── */

/** The source's `storeState` is the availability flag (verified on-site). */
export function availabilityLabel(
  availability: Availability | null | undefined,
): string {
  switch (availability) {
    case "InStock":
      return "Available";
    case "OutOfStock":
      return "Unavailable";
    default:
      return "Availability unknown";
  }
}

/* ── Mapping: normalized shapes -> app `ProductDetails` ─────────── */

function categoryRefsFromBreadcrumb(
  categories: Array<{
    sourceCategoryId: number | null;
    name: string;
    url: string | null;
  }>,
): CategoryRef[] {
  return categories.map((category, index) => ({
    id:
      category.sourceCategoryId !== null
        ? String(category.sourceCategoryId)
        : category.name,
    name: category.name,
    slug: category.url,
    parent_id: null,
    parent_name: null,
    breadcrumbs: categories.slice(0, index).map((ancestor) => ancestor.name),
  }));
}

/** Category label for a listing hit, from the source's own navigation tree. */
function listingCategoryRefs(product: NormalizedProductSummary): CategoryRef[] {
  const node = findCategoryForProductUrl(
    getCachedCategoryTree(),
    product.productUrl,
  );
  if (!node) return [];
  return [
    {
      id: node.id !== null ? String(node.id) : node.url,
      name: node.title,
      slug: node.url,
      parent_id: node.parentId !== null ? String(node.parentId) : null,
      parent_name: null,
      breadcrumbs: null,
    },
  ];
}

function listingProductToDetails(
  product: NormalizedProductSummary,
): ProductDetails {
  return {
    id: String(product.sourceProductId),
    source_id: "darukade",
    source_page_id: null,
    canonical_url: product.productUrl || null,
    name: product.nameFa || "",
    name_en: null,
    name_fa: product.nameFa || null,
    slug: null,
    brand: product.brand || null,
    description: null,
    sku: null,
    barcode: null,
    price: product.price ?? product.originalPrice ?? null,
    originalPrice: product.originalPrice,
    discountPercent: product.discountPercent,
    currency: "IRT",
    availability: product.availability,
    manufacturer: null,
    form: product.variantTypeTitle || null,
    package_size: product.variantTitle || null,
    image_urls:
      product.images.length > 0
        ? product.images
        : product.image
          ? [product.image]
          : null,
    attributes: null,
    source_payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ingredients: [],
    categories: listingCategoryRefs(product),
    detailLoaded: false,
  };
}

function ingredientRefs(detail: NormalizedProductDetail): IngredientRef[] {
  return (detail.ingredients ?? []).map((ingredient) => ({
    name: ingredient.nameEn || ingredient.nameFa || ingredient.rawName || "",
    name_en: ingredient.nameEn || null,
    name_fa: ingredient.nameFa || null,
    amount: ingredient.amount,
    unit: ingredient.unit || null,
    form: null,
    raw_name: ingredient.rawName || null,
    daily_needed: ingredient.dailyNeeded || null,
  }));
}

function variantRefs(detail: NormalizedProductDetail): ProductVariant[] {
  return (detail.variants ?? []).map((variant) => ({
    id: String(variant.sourceVariantId),
    title: variant.title,
    productCode: variant.productCode,
    color: variant.color,
    isMaster: variant.isMaster,
    originalPrice: variant.originalPrice,
    price: variant.price,
    discountPercent: variant.discountPercent,
    availability: variant.availability,
    image_urls: variant.images,
  }));
}

function propertyRefs(detail: NormalizedProductDetail): ProductProperty[] {
  return (detail.properties ?? []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const property = entry as Record<string, unknown>;
    const title =
      typeof property.title === "string" ? property.title.trim() : "";
    if (!title) return [];
    const value =
      typeof property.value === "string" ? property.value.trim() : null;
    const url = typeof property.url === "string" ? property.url : null;
    return [{ title, value, url }];
  });
}

function detailToDetails(detail: NormalizedProductDetail): ProductDetails {
  const masterVariant =
    detail.variants.find((variant) => variant.isMaster) ?? null;
  const packageSize = masterVariant?.title || null;

  return {
    id: String(detail.sourceProductId),
    source_id: "darukade",
    source_page_id: null,
    canonical_url: detail.productUrl || null,
    name: detail.nameFa || detail.nameEn || "",
    name_en: detail.nameEn || null,
    name_fa: detail.nameFa || null,
    slug: null,
    brand: detail.brand || null,
    brand_fa: detail.brandFa || null,
    description: detail.description || null,
    sku: detail.productCode || null,
    barcode: null,
    price: detail.price ?? detail.originalPrice ?? null,
    originalPrice: detail.originalPrice,
    discountPercent: detail.discountPercent,
    currency: "IRT",
    availability: detail.availability,
    manufacturer: null,
    form: masterVariant?.title || detail.variantTypeTitle || null,
    package_size: packageSize,
    image_urls:
      detail.images.length > 0
        ? detail.images
        : detail.image
          ? [detail.image]
          : null,
    attributes: null,
    source_payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ingredients: ingredientRefs(detail),
    categories: categoryRefsFromBreadcrumb(detail.categories),
    variants: variantRefs(detail),
    properties: propertyRefs(detail),
    ingredientServing: detail.ingredientServing,
    detailLoaded: true,
  };
}

function listingToHits(listing: ListingPage, maxRank = 1): ProductSearchHit[] {
  const length = Math.max(1, listing.products.length);
  return listing.products.map((product, index) => ({
    rank: Number((maxRank - index / length).toFixed(4)) || 1,
    product: listingProductToDetails(product),
  }));
}

/* ── Detail fetching (selective, deduped, bounded) ──────────────── */

/** Per-detail-request timeout during enrichment. */
const DETAIL_TIMEOUT_MS = 6_000;

async function fetchDetailOnce(
  product: ProductDetails,
): Promise<ProductDetails | null> {
  const url = product.canonical_url;
  if (!url) return null;

  const cached = detailCache.get(url);
  if (cached && Date.now() - cached.ts < DETAIL_CACHE_TTL_MS) {
    return cached.product;
  }
  detailCache.delete(url);

  const existing = inflightDetails.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const fetched = await client.fetchProduct(url, {
        timeoutMs: DETAIL_TIMEOUT_MS,
        retries: 1,
      });
      const details = detailToDetails(fetched.product);
      detailCache.set(url, { product: details, ts: Date.now() });
      trimCache(detailCache, DETAIL_CACHE_MAX);
      return details;
    } catch (error) {
      console.warn(
        `Darukade detail fetch failed for ${url}:`,
        (error as Error).message,
      );
      return null;
    }
  })();

  inflightDetails.set(url, promise);
  try {
    return await promise;
  } finally {
    inflightDetails.delete(url);
  }
}

export interface EnrichOptions {
  /** How many (top-ranked) products get their full page fetched. */
  detailLimit?: number;
  /** Wall-clock budget for the whole enrichment phase. */
  budgetMs?: number;
}

/**
 * Fetch full details for the top `detailLimit` products, in parallel through
 * the shared pacer, stopping when the time budget expires. Products whose
 * details could not be retrieved keep their listing data with
 * `detailLoaded: false`, so the UI can say "Ingredients unavailable" instead
 * of inventing an empty ingredient list.
 */
export async function enrichProductDetails(
  products: ProductDetails[],
  options: EnrichOptions = {},
): Promise<{
  products: ProductDetails[];
  enriched: number;
  budgetExpired: boolean;
}> {
  const detailLimit = options.detailLimit ?? 8;
  const budgetMs = options.budgetMs ?? 6_000;

  const targets = products.slice(0, detailLimit);
  if (targets.length === 0) {
    return { products, enriched: 0, budgetExpired: false };
  }

  let budgetExpired = false;
  const results = new Map<string, ProductDetails | null>();

  const task = (async () => {
    await Promise.all(
      targets.map(async (product) => {
        const enriched = await fetchDetailOnce(product);
        results.set(product.id, enriched);
      }),
    );
  })();

  await Promise.race([
    task,
    sleep(budgetMs).then(() => {
      budgetExpired = true;
    }),
  ]);

  // Whatever is still in flight keeps running in the background; its results
  // land in the cache for the next request.
  if (!budgetExpired) {
    try {
      await task;
    } catch {
      // individual failures are already handled inside fetchDetailOnce
    }
  }

  const productsOut = products.map((product) => {
    const enriched = results.get(product.id);
    return enriched ?? product;
  });

  let enrichedCount = 0;
  for (const product of productsOut) {
    if (product.detailLoaded) enrichedCount += 1;
  }
  return { products: productsOut, enriched: enrichedCount, budgetExpired };
}

/* ── Search ─────────────────────────────────────────────────────── */

export interface SearchOptions {
  limit?: number;
  /** Enrichment settings for the returned hits. */
  detailLimit?: number;
  budgetMs?: number;
  /** A resolved category request from the verified tree. */
  category?: ReturnType<typeof requestForCategoryNode>;
}

export interface SearchOutcome {
  hits: ProductSearchHit[];
  enriched: number;
  totalProducts: number;
  timings: { listingMs: number; enrichMs: number; totalMs: number };
}

function listingQueryFor(params: {
  search?: string;
  category?: ReturnType<typeof requestForCategoryNode>;
}): ListingQuery {
  const request = params.category;
  if (!request || request.kind === "unsupported") {
    return { search: params.search };
  }
  if (request.kind === "category") {
    return {
      search: params.search,
      category: request.categoryId,
      extra: request.extra,
    };
  }
  if (request.kind === "path") {
    return { search: params.search, path: request.path, extra: request.extra };
  }
  // filters: g/ty on the root listing
  return { search: params.search, extra: request.extra };
}

/**
 * Search Darukade products. Listing first, then selective detail enrichment.
 */
export async function searchProducts(
  query: string,
  options: SearchOptions = {},
): Promise<SearchOutcome> {
  const startedAt = Date.now();
  const limit = options.limit ?? 20;
  const trimmed = query.trim();
  // An empty query is only meaningful when a category constrains the listing.
  if (!trimmed && !options.category) {
    return {
      hits: [],
      enriched: 0,
      totalProducts: 0,
      timings: { listingMs: 0, enrichMs: 0, totalMs: 0 },
    };
  }

  const listingQuery = listingQueryFor({
    search: trimmed,
    category: options.category,
  });
  const fetched = await client.listProductsData(listingQuery);
  const listingMs = Date.now() - startedAt;
  rememberListing(fetched.listing);
  warmCategoryTreeFromPageProps(fetched.pageProps.headerFooterData);

  const hits = listingToHits(fetched.listing).slice(0, limit);
  const enrichStarted = Date.now();
  const { products, enriched } = await enrichProductDetails(
    hits.map((hit) => hit.product),
    { detailLimit: options.detailLimit, budgetMs: options.budgetMs },
  );
  const enrichMs = Date.now() - enrichStarted;

  return {
    hits: hits.map((hit, index) => ({
      rank: hit.rank,
      product: products[index] ?? hit.product,
    })),
    enriched,
    totalProducts: fetched.listing.totalProducts,
    timings: { listingMs, enrichMs, totalMs: Date.now() - startedAt },
  };
}

/**
 * Backwards-compatible wrappers used by the chat pipeline and search page.
 * They enrich by default so product cards carry ingredients when available.
 */
export async function searchDarukade(
  query: string,
  limit = 20,
): Promise<ProductSearchHit[]> {
  const outcome = await searchProducts(query, { limit });
  return outcome.hits;
}

export async function searchDarukadeAi(
  query: string,
  limit = 20,
): Promise<ProductSearchHit[]> {
  // AI-specific weighting lives in product-retrieval; here the same pipeline runs.
  return searchDarukade(query, limit);
}

/* ── Ingredient search ──────────────────────────────────────────── */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (char) => {
      const p = PERSIAN_DIGITS.indexOf(char);
      if (p >= 0) return String(p);
      const a = ARABIC_DIGITS.indexOf(char);
      return a >= 0 ? String(a) : char;
    })
    .replace(/[\u064a\u0649]/g, "\u06cc")
    .replace(/[\u0643]/g, "\u06a9")
    .replace(/[\u0629]/g, "\u0647")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/[\u064b-\u0652\u0640\u200b\u200c\u200e\u200f]/g, "")
    .replace(/[._(),/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when a structured ingredient name refers to the searched term. */
export function ingredientNameMatches(
  term: string,
  candidate: string,
): boolean {
  const needle = normalizeSearchText(term);
  const haystack = normalizeSearchText(candidate);
  if (!needle || !haystack) return false;
  if (haystack === needle) return true;
  // Whole-word containment so "iron" matches "iron oxide" but not "environ".
  const word = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${word}([^\\p{L}\\p{N}]|$)`,
    "u",
  );
  return pattern.test(haystack);
}

export interface IngredientSearchOutcome extends SearchOutcome {
  checked: number;
  matched: number;
  /** True when structured ingredient data could not be checked at all. */
  unverified: boolean;
}

/**
 * Ingredient search: discover via the listing API, then keep only products
 * whose *structured* ingredient list matches the term. A product name match
 * alone is never treated as proof that the product contains the ingredient.
 */
export async function searchProductsByIngredient(
  ingredient: string,
  options: SearchOptions = {},
): Promise<IngredientSearchOutcome> {
  const outcome = await searchProducts(ingredient, {
    ...options,
    limit: options.limit ?? 24,
    detailLimit: options.detailLimit ?? 12,
    budgetMs: options.budgetMs ?? 8_000,
  });

  const matched = outcome.hits.filter((hit) => {
    const product = hit.product;
    if (!product.detailLoaded) return false;
    return product.ingredients.some((entry) =>
      [entry.name, entry.name_en, entry.name_fa, entry.raw_name]
        .filter((value): value is string => Boolean(value))
        .some((name) => ingredientNameMatches(ingredient, name)),
    );
  });

  const checked = outcome.hits.filter((hit) => hit.product.detailLoaded).length;
  return {
    ...outcome,
    hits: matched,
    checked,
    matched: matched.length,
    unverified: checked === 0,
  };
}

/* ── Product detail ─────────────────────────────────────────────── */

export async function getProductBySourceId(
  id: string | number,
  fallbackUrl?: string | null,
): Promise<ProductDetails | null> {
  const num = typeof id === "string" ? Number.parseInt(id, 10) : id;
  if (!Number.isFinite(num)) return null;

  const url = fallbackUrl || rememberedUrl(String(num));
  if (!url) return null;
  return getProductByUrl(url);
}

export async function getProductByUrl(
  url: string,
): Promise<ProductDetails | null> {
  try {
    const fetched = await client.fetchProduct(url, {
      timeoutMs: 12_000,
      retries: 1,
    });
    const details = detailToDetails(fetched.product);
    detailCache.set(fetched.product.productUrl || url, {
      product: details,
      ts: Date.now(),
    });
    trimCache(detailCache, DETAIL_CACHE_MAX);
    return details;
  } catch (error) {
    console.error("Darukade get product by URL failed:", error);
    return null;
  }
}

/* ── Related products ───────────────────────────────────────────── */

export interface RelatedProductRef {
  kind: string;
  product: ProductDetails;
}

/** Related/alternative products from the source's fetchrelated endpoint. */
export async function getRelatedProductsFor(
  id: string | number,
): Promise<RelatedProductRef[]> {
  const num = typeof id === "string" ? Number.parseInt(id, 10) : id;
  if (!Number.isFinite(num)) return [];
  try {
    const relationships = await client.fetchRelated(num, {
      timeoutMs: 6_000,
      retries: 1,
    });
    const out: RelatedProductRef[] = [];
    const seen = new Set<number>();
    for (const relation of relationships) {
      if (seen.has(relation.relatedSourceProductId)) continue;
      if (!relation.url) continue;
      seen.add(relation.relatedSourceProductId);
      const price = relation.price ?? relation.originalPrice ?? null;
      const availability: Availability =
        relation.storeState === true
          ? "InStock"
          : relation.storeState === false
            ? "OutOfStock"
            : "Unknown";
      out.push({
        kind: relation.kind,
        product: {
          id: String(relation.relatedSourceProductId),
          source_id: "darukade",
          source_page_id: null,
          canonical_url: relation.url.startsWith("/")
            ? `https://darukade.com${relation.url}`
            : relation.url,
          name: relation.title || "",
          name_en: null,
          name_fa: relation.title || null,
          slug: null,
          brand: relation.brandName || null,
          description: null,
          sku: null,
          barcode: null,
          price,
          currency: "IRT",
          availability,
          manufacturer: null,
          form: null,
          package_size: null,
          image_urls: relation.image ? [relation.image] : null,
          attributes: null,
          source_payload: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ingredients: [],
          categories: [],
          detailLoaded: false,
        },
      });
    }
    return out.slice(0, 12);
  } catch (error) {
    console.error("Darukade fetchrelated failed:", error);
    return [];
  }
}

/* ── Category helpers (for pages) ──────────────────────────────── */

export async function resolveCategoryTree() {
  return getCategoryTree();
}

export function resolveCategoryNode(
  tree: ReturnType<typeof getCachedCategoryTree>,
  id: string,
) {
  return findCategoryNodeById(tree, id);
}

export { requestForCategoryNode as categoryRequestForNode };

/** Products under a category, optionally narrowed by a search term. */
export async function searchByCategory(params: {
  categoryNode: { id: number | null; title: string; url: string };
  search?: string;
  limit?: number;
  detailLimit?: number;
  budgetMs?: number;
}): Promise<
  SearchOutcome & {
    categoryTitle: string;
    categoryUrl: string;
    note: string | null;
  }
> {
  const tree = await getCategoryTree();
  const found =
    tree.find((candidate) => candidate.id === params.categoryNode.id) ?? null;
  const request = requestForCategoryNode(
    found ?? {
      id: params.categoryNode.id,
      title: params.categoryNode.title,
      url: params.categoryNode.url,
      parentId: null,
      depth: 0,
      children: [],
    },
  );
  const note =
    request.kind === "unsupported"
      ? "The source does not support searching inside this category; results are unfiltered."
      : request.droppedRefinement
        ? "Some fine-grained source refinements are ignored while searching."
        : null;
  const outcome = await searchProducts(params.search ?? "", {
    limit: params.limit,
    detailLimit: params.detailLimit,
    budgetMs: params.budgetMs,
    category: request,
  });
  return {
    ...outcome,
    categoryTitle: params.categoryNode.title,
    categoryUrl: params.categoryNode.url,
    note,
  };
}
