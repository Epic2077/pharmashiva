/**
 * Darukade raw response shapes and the normalized internal shapes the
 * repository persists.
 *
 * The raw types mirror what the site actually returns (including its spelling
 * quirks such as `orginalCost` and `productMataData`). The normalized types are
 * what the rest of the app sees, and they are the only place where source field
 * names appear.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

/* ── Raw: listing (categoryMataData.products[]) ─────────────────── */

export interface RawListingProduct {
  id: number;
  faName: string;
  productURL: string;
  image?: string | null;
  brandEnName?: string | null;
  brandURL?: string | null;
  rank?: number | null;
  slaveTitle?: string | null;
  slaveTypeID?: number | null;
  slaveTypeTitle?: string | null;
  slaveCount?: number | null;
  orginalCost?: number | null;
  discountCost?: number | null;
  discountPercent?: number | null;
  storeState?: boolean | null;
  storeCount?: number | null;
  quickBuy?: boolean | null;
  hasGift?: boolean | null;
  isADV?: boolean | null;
  freeDelivery?: boolean | null;
}

export interface RawListingFilters {
  pages?: {
    totalPage?: number;
    currentPage?: number;
    pageProductCount?: number;
    totalProductCount?: number;
    querystring?: string;
  } | null;
}

export interface RawCategoryMataData {
  title?: string | null;
  breadCrumb?: Array<{ id: number; title: string; url: string }> | null;
  filters?: RawListingFilters | null;
  products?: RawListingProduct[] | null;
  categoryID?: string | null;
  url?: string | null;
  description?: string | null;
}

/* ── Raw: product page sections ─────────────────────────────────── */

export interface RawVariantImage {
  id?: number;
  image?: string | null;
  videoURL?: string | null;
  type?: number | null;
}

export interface RawVariant {
  id: number;
  productCode?: string | null;
  typeID?: number | null;
  isSelected?: boolean | null;
  isMaster?: boolean | null;
  title?: string | null;
  image?: string | null;
  color?: string | null;
  orginalCost?: number | null;
  discountCost?: number | null;
  discountPercent?: number | null;
  storeState?: boolean | null;
  storeCount?: number | null;
  maxSell?: number | null;
  expiration?: string | null;
  images?: RawVariantImage[] | null;
  freeDelivery?: boolean | null;
}

export interface RawSlaveGroup {
  id?: number;
  title?: string | null;
  variety?: string | null;
  items?: RawVariant[] | null;
}

export interface RawSection1 {
  id: number;
  productCode?: string | null;
  faName?: string | null;
  enName?: string | null;
  productURL?: string | null;
  breadCrumb?: Array<{ id: number; title: string; url: string }> | null;
  brandID?: number | null;
  brandFaName?: string | null;
  brandEnName?: string | null;
  brandURL?: string | null;
  visit?: string | null;
  rank?: number | null;
  satisfyPercent?: number | null;
  commentCount?: number | null;
  viewPointCount?: number | null;
  slaves?: RawSlaveGroup | RawSlaveGroup[] | null;
  review?: { title?: string | null; content?: string | null } | null;
  notice?: Json[] | null;
  flagName?: string | null;
}

export interface RawBulletList {
  icon?: string | null;
  title?: string | null;
  list?: Array<{
    id?: number;
    content?: string | null;
    image?: string | null;
    value?: string | null;
  }> | null;
}

export interface RawProperty {
  id?: number;
  title?: string | null;
  value?: string | null;
  url?: string | null;
}

export interface RawIngredient {
  id?: number;
  enName?: string | null;
  faName?: string | null;
  amount?: string | null;
  dailyNeeded?: string | null;
}

export interface RawRelationshipProduct {
  id: number;
  productID?: number;
  rowIndex?: number | null;
  image?: string | null;
  productName?: string | null;
  productURL?: string | null;
  cost?: number | null;
  orginalCost?: number | null;
  discountPercent?: number | null;
  storeState?: boolean | null;
  brandName?: string | null;
  brandURL?: string | null;
  rank?: number | null;
}

export interface RawRelationshipGroup {
  id?: number;
  title?: string | null;
  products?: RawRelationshipProduct[] | null;
}

export interface RawSection2 {
  relatedProducts?: RawRelationshipGroup | null;
  sameBrandProducts?: RawRelationshipGroup | null;
  complementaryProducts?: RawRelationshipGroup | null;
  alternativeProducts?: RawRelationshipGroup | null;
  properties?: RawProperty[] | null;
  characteristics?: RawBulletList | null;
  usage?: RawBulletList | null;
  keepConditions?: RawBulletList | null;
  warning?: RawBulletList | null;
  userguid?: string | null;
  ingredients?: RawIngredient[] | null;
  ingredientperuse?: string | null;
}

export interface RawSection3 {
  description?: string | null;
  expertReview?: string | null;
  faq?: Json[] | null;
  videos?: Json[] | null;
}

export interface RawProductMataData {
  id?: number;
  masterID?: number;
  pid?: string | null;
}

/* ── Normalized ─────────────────────────────────────────────────── */

/**
 * Availability is tri-state on purpose. The source's `storeState` flag is
 * definitive when present, but a missing flag must never be presented as
 * "out of stock" — that would invent a fact the source did not report.
 */
export type Availability = "InStock" | "OutOfStock" | "Unknown";

export type RelationshipKind =
  | "related"
  | "same_brand"
  | "complementary"
  | "alternative"
  | "similar";

export interface NormalizedVariant {
  sourceVariantId: number;
  typeId: number | null;
  title: string | null;
  productCode: string | null;
  color: string | null;
  isMaster: boolean;
  isSelected: boolean;
  /** Price before discount, in Toman. */
  originalPrice: number | null;
  /** Current selling price, in Toman. */
  price: number | null;
  discountPercent: number | null;
  currency: "IRT";
  availability: Availability;
  stockCount: number | null;
  maxSell: number | null;
  expiration: string | null;
  /** Real images only (placeholder filtered out), absolute URLs. */
  images: string[];
}

export interface NormalizedIngredient {
  /** English label from the source (`enName`). */
  nameEn: string | null;
  /** Persian label from the source (`faName`). */
  nameFa: string | null;
  /** The original, unmodified source string (provenance). */
  rawName: string;
  amount: number | null;
  unit: string | null;
  /** Original amount string, e.g. "5 g". */
  rawAmount: string | null;
  dailyNeeded: string | null;
}

export interface NormalizedCategory {
  /** Numeric Darukade category id parsed from the source URL, when present. */
  sourceCategoryId: number | null;
  /** Persian category name as published by the source. */
  name: string;
  /** Site-relative URL of the category page. */
  url: string | null;
}

export interface NormalizedRelationship {
  relatedSourceProductId: number;
  kind: RelationshipKind;
  title: string | null;
  url: string | null;
  position: number;
}

export interface NormalizedProductSummary {
  sourceProductId: number;
  productUrl: string;
  nameFa: string;
  brand: string | null;
  brandUrl: string | null;
  /** Primary image (absolute), placeholder filtered out. */
  image: string | null;
  images: string[];
  originalPrice: number | null;
  price: number | null;
  discountPercent: number | null;
  currency: "IRT";
  availability: Availability;
  stockCount: number | null;
  rating: number | null;
  variantTitle: string | null;
  variantTypeTitle: string | null;
  variantCount: number | null;
  quickBuy: boolean;
  freeDelivery: boolean;
  /** Did the source mark this an advertisement/sponsored slot? */
  isAd: boolean;
}

export interface NormalizedProductDetail extends NormalizedProductSummary {
  masterId: number | null;
  productCode: string | null;
  nameEn: string | null;
  reviewCount: number | null;
  viewCount: string | null;
  categories: NormalizedCategory[];
  variants: NormalizedVariant[];
  ingredients: NormalizedIngredient[];
  ingredientServing: string | null;
  properties: Json[];
  characteristics: Json | null;
  usage: Json | null;
  keepConditions: Json | null;
  warnings: Json | null;
  usageInstructions: string | null;
  description: string | null;
  descriptionHtml: string | null;
  expertReviewHtml: string | null;
  relationships: NormalizedRelationship[];
  /** Stable hash of the normalized payload, used to skip unchanged rows. */
  contentHash: string;
  /** Trimmed raw sections, retained for debugging/normalization. */
  raw: Json;
}
