/**
 * TypeScript mirrors of the SiteHarvest Postgres schema.
 * `DATABASE_USAGE.md` is the authoritative description of these tables.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

/* ── Tables ─────────────────────────────────────────────────── */

export interface Source {
  id: string;
  base_url: string;
  name: string | null;
  technologies: Json | null;
}

export type CrawlStatus = "running" | "completed" | "failed" | "cancelled";

export interface Crawl {
  id: string;
  source_id: string;
  status: CrawlStatus;
  pages_seen: number | null;
  products_found: number | null;
  errors: number | null;
  metadata: Json | null;
}

export interface Page {
  id: string;
  source_id: string;
  url: string;
  canonical_url: string | null;
  title: string | null;
  description: string | null;
  content_type: string | null;
  raw_html: string | null;
  content_text: string | null;
  partitions: Json | null;
}

export interface Category {
  id: string;
  source_id: string;
  name: string;
  slug: string | null;
  /** `null` = root category. */
  parent_id: string | null;
  parent_name: string | null;
  source_url: string | null;
  /** Path from root to this category, e.g. `["داروخانه", "مکمل"]`. */
  breadcrumbs: string[] | null;
}

/** Normalized availability tokens: `InStock`, `OutOfStock`, `PreOrder`, … */
export type Availability = string;

export interface Product {
  id: string;
  source_id: string;
  source_page_id: string | null;
  canonical_url: string | null;
  /** Primary display name (Persian on darukade). */
  name: string;
  name_en: string | null;
  name_fa: string | null;
  slug: string | null;
  brand: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  /** `IRT` (Toman), `IRR` (Rial), `USD`, `EUR`. */
  currency: string | null;
  availability: Availability | null;
  manufacturer: string | null;
  /** e.g. tablet, capsule, liquid. */
  form: string | null;
  package_size: string | null;
  image_urls: string[] | null;
  attributes: Json | null;
  /** Full raw extracted product record. */
  source_payload: Json | null;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  /** English when available, else the source name. */
  canonical_name: string;
  persian_name: string | null;
  aliases: string[] | null;
  ingredient_type: string | null;
  description: string | null;
  metadata: Json | null;
}

export interface ProductIngredient {
  product_id: string;
  ingredient_id: string;
  amount: number | null;
  unit: string | null;
  form: string | null;
  raw_name: string | null;
}

export interface ProductCategory {
  product_id: string;
  category_id: string;
}

/* ── Enriched / query-result shapes ─────────────────────────── */

/** One row returned by the `search_products(...)` RPC. */
export interface ProductSearchResult {
  id: string;
  name: string;
  name_en: string | null;
  brand: string | null;
  description: string | null;
  rank: number;
}

/** An ingredient flattened for a product. */
export interface IngredientRef {
  name: string;
  name_en: string | null;
  name_fa: string | null;
  amount: number | null;
  unit: string | null;
  form: string | null;
  raw_name: string | null;
}

/** A category flattened for a product. */
export interface CategoryRef {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  parent_name: string | null;
  breadcrumbs: string[] | null;
}

/** A product with its leaf categories and ingredients joined in. */
export interface ProductDetails extends Product {
  ingredients: IngredientRef[];
  categories: CategoryRef[];
}

/** A category with its children nested in. */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** A category with the number of products in its whole subtree. */
export interface CategoryWithCount extends Category {
  productCount: number;
}

/** A search hit pairing the RPC rank with the full product row. */
export interface ProductSearchHit {
  rank: number;
  product: Product;
}
