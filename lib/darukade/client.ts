/**
 * High-level Darukade client.
 *
 * Reads SSR HTML and parses the embedded `__NEXT_DATA__` rather than depending
 * on the volatile `/_next/data/{buildId}` JSON endpoints; the build ID is still
 * discoverable for callers that want it.
 *
 * Ingestion must never run on a user request path — this module is meant to be
 * driven by the sync script, not by route handlers.
 */

import { getDarukadeConfig } from "./config.ts";
import { ParseError } from "./errors.ts";
import { RequestPacer, fetchDarukade, type FetchOptions } from "./http.ts";
import { extractBuildId, fetchNextData, type NextData } from "./next-data.ts";
import { normalizeListing, normalizeProduct, type ListingPage } from "./normalize.ts";
import type {
  NormalizedProductDetail,
  NormalizedRelationship,
  RawCategoryMataData,
  RawProductMataData,
  RawRelationshipGroup,
  RawSection1,
  RawSection2,
  RawSection3,
  RelationshipKind,
} from "./types.ts";

export interface DarukadeClientOptions {
  signal?: AbortSignal;
  concurrency?: number;
  minIntervalMs?: number;
}

/** Query parameters accepted by `/products`. */
export interface ListingQuery {
  /** Free-text search term (`w`). */
  search?: string;
  /** Top-level category id (`c`). */
  category?: number | string;
  /** Tag-list filter (`tl`). */
  tags?: string;
  /** Group filter (`g`). */
  group?: string;
  /** 1-based page (`p`). */
  page?: number;
}

function pageProps(data: NextData): Record<string, unknown> {
  return data.props.pageProps;
}

/** Extract `categoryMataData`, tolerating missing/renamed payloads. */
function readCategoryMataData(data: NextData, url: string): RawCategoryMataData {
  const value = pageProps(data).categoryMataData;
  if (!value || typeof value !== "object") {
    throw new ParseError("Listing payload missing `categoryMataData`", url);
  }
  return value as RawCategoryMataData;
}

export interface FetchedProduct {
  product: NormalizedProductDetail;
  notModified: boolean;
}

export class DarukadeClient {
  private readonly pacer: RequestPacer;
  private readonly signal: AbortSignal | undefined;
  private buildIdCache: string | null = null;

  constructor(options: DarukadeClientOptions = {}) {
    const config = getDarukadeConfig();
    this.pacer = new RequestPacer(
      options.concurrency ?? config.concurrency,
      options.minIntervalMs ?? config.minIntervalMs,
    );
    this.signal = options.signal;
  }

  private options(extra: FetchOptions = {}): FetchOptions {
    return { signal: this.signal, ...extra };
  }

  /** Build the `/products` path for a listing query. */
  static listingPath(query: ListingQuery): string {
    const params = new URLSearchParams();
    if (query.search) params.set("w", query.search);
    if (query.category !== undefined) params.set("c", String(query.category));
    if (query.tags) params.set("tl", query.tags);
    if (query.group) params.set("g", query.group);
    if (query.page && query.page > 1) params.set("p", String(query.page));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  /** Current Next.js build ID, cached for the life of the client. */
  async getBuildId(): Promise<string | null> {
    if (this.buildIdCache) return this.buildIdCache;
    const response = await this.pacer.run(() => fetchDarukade("/", this.options()));
    this.buildIdCache = extractBuildId(response.text);
    return this.buildIdCache;
  }

  /** Fetch and normalize a listing page (search or category). */
  async listProducts(query: ListingQuery): Promise<ListingPage> {
    const path = DarukadeClient.listingPath(query);
    const { data, url } = await this.pacer.run(() => fetchNextData(path, this.options()));
    return normalizeListing(readCategoryMataData(data, url));
  }

  /** Fetch a category listing by its canonical path, e.g. `supplement-creatine-171`. */
  async listCategoryPath(categoryPath: string, page = 1): Promise<ListingPage> {
    const clean = categoryPath.replace(/^\/+/, "").replace(/^products\//, "");
    const suffix = page > 1 ? `?p=${page}` : "";
    const { data, url } = await this.pacer.run(() =>
      fetchNextData(`/products/${clean}${suffix}`, this.options()),
    );
    return normalizeListing(readCategoryMataData(data, url));
  }

  /**
   * Iterate every page of a listing query up to `maxPages`, yielding each
   * normalized page and stopping when the source reports no further pages.
   */
  async *iterateListings(
    query: ListingQuery,
    maxPages = Number.POSITIVE_INFINITY,
  ): AsyncGenerator<ListingPage> {
    let page = query.page ?? 1;
    for (let seen = 0; seen < maxPages; seen += 1) {
      const listing = await this.listProducts({ ...query, page });
      yield listing;
      if (listing.products.length === 0 || page >= listing.totalPages) break;
      page += 1;
    }
  }

  /** Fetch, parse and normalize a single product page. */
  async fetchProduct(pathOrUrl: string): Promise<FetchedProduct> {
    const { data, url, notModified } = await this.pacer.run(() =>
      fetchNextData(pathOrUrl, this.options()),
    );
    if (notModified) throw new ParseError("Product page reported unchanged", url);
    const props = pageProps(data);
    const section1 = props.section1Data as RawSection1 | undefined;
    if (!section1 || typeof section1.id !== "number") {
      throw new ParseError("Product payload missing `section1Data`", url);
    }
    const product = normalizeProduct({
      section1,
      section2: (props.section2Data ?? null) as RawSection2 | null,
      section3: (props.section3Data ?? null) as RawSection3 | null,
      meta: (props.productMataData ?? null) as RawProductMataData | null,
    });
    if (!product.nameFa) {
      throw new ParseError("Normalized product has no name", url);
    }
    return { product, notModified: false };
  }

  /** Fetch the related-products groups for a product id. */
  async fetchRelated(sourceProductId: number): Promise<NormalizedRelationship[]> {
    const response = await this.pacer.run(() =>
      fetchDarukade(
        `/api/products/fetchrelated?id=${sourceProductId}`,
        this.options({ accept: "application/json, */*" }),
      ),
    );
    if (!response.ok) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return [];
    }
    if (!parsed || typeof parsed !== "object") return [];
    const groups = parsed as Record<string, RawRelationshipGroup | undefined>;
    const mapping: Array<[string, RelationshipKind]> = [
      ["relatedProducts", "related"],
      ["sameBrandProducts", "same_brand"],
      ["complementaryProducts", "complementary"],
      ["alternativeProducts", "alternative"],
    ];
    const out: NormalizedRelationship[] = [];
    for (const [key, kind] of mapping) {
      const products = groups[key]?.products ?? [];
      products.forEach((product, index) => {
        if (typeof product?.id !== "number") return;
        out.push({
          relatedSourceProductId: product.id,
          kind,
          title: product.productName?.trim() || null,
          url: product.productURL ?? null,
          position: typeof product.rowIndex === "number" ? product.rowIndex : index,
        });
      });
    }
    return out;
  }
}
