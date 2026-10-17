/**
 * Normalization: raw Darukade JSON -> internal shapes.
 *
 * This is the only module that knows Darukade's field spellings (`faName`,
 * `orginalCost`, `productMataData`, …) and its quirks (prices are in Toman and
 * mislabelled "IRR" in the site's JSON-LD, images include a shared
 * `NOImage.jpg`, `storeState` is the availability flag). Keeping that knowledge
 * here means the repository, search and UI never have to.
 */

import { createHash } from "node:crypto";
import { productImages } from "../product-images.ts";
import { DARUKADE_ORIGIN } from "./config.ts";
import type {
  Availability,
  Json,
  NormalizedCategory,
  NormalizedIngredient,
  NormalizedProductDetail,
  NormalizedProductSummary,
  NormalizedRelationship,
  NormalizedVariant,
  RawCategoryMataData,
  RawIngredient,
  RawListingProduct,
  RawProductMataData,
  RawRelationshipGroup,
  RawSection1,
  RawSection2,
  RawSection3,
  RawSlaveGroup,
  RawVariant,
  RelationshipKind,
} from "./types.ts";

/** Darukade prices are in Toman (verified against the site's Toman display). */
export const CURRENCY = "IRT" as const;

/* ── Small helpers ──────────────────────────────────────────────── */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Persian/Arabic-Indic digits to ASCII. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const p = PERSIAN_DIGITS.indexOf(char);
    if (p >= 0) return String(p);
    const a = ARABIC_DIGITS.indexOf(char);
    return a >= 0 ? String(a) : char;
  });
}

/** Coerce a source value to a finite number, or `null`. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(toAsciiDigits(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Turn a site-relative URL into an absolute darukade.com URL. */
export function absoluteUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  try {
    return new URL(pathOrUrl, DARUKADE_ORIGIN).href;
  } catch {
    return null;
  }
}

/** Strip HTML tags and decode the handful of entities the source uses. */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*(br|\/li|\/p|\/div|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/gi, "'")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text.length > 0 ? text : null;
}

/** Parse an amount string such as "5 g" / "500 mg" / "۱۰ گرم". */
export function parseAmount(raw: string | null | undefined): {
  amount: number | null;
  unit: string | null;
} {
  if (!raw) return { amount: null, unit: null };
  const ascii = toAsciiDigits(raw).trim();
  const match = ascii.match(/^([\d.,/]+)\s*(.*)$/);
  if (!match) return { amount: null, unit: ascii || null };
  const amount = Number.parseFloat(match[1]!.replace(/,/g, ""));
  const unit = match[2]!.trim();
  return {
    amount: Number.isFinite(amount) ? amount : null,
    unit: unit.length > 0 ? unit : null,
  };
}

/** Map `storeState` to a normalized availability token (tri-state). */
export function normalizeAvailability(storeState: unknown): Availability {
  if (storeState === true) return "InStock";
  if (storeState === false) return "OutOfStock";
  return "Unknown";
}

/**
 * Split a source price pair into `{ originalPrice, price, discountPercent }`.
 * `originalPrice` is only kept when there is a genuine discount.
 */
export function normalizePrices(
  originalCost: unknown,
  discountCost: unknown,
  discountPercent: unknown,
): {
  originalPrice: number | null;
  price: number | null;
  discountPercent: number | null;
} {
  const original = toNumber(originalCost);
  const discount = toNumber(discountCost);
  const pct = toNumber(discountPercent) ?? 0;

  if (pct > 0 && original !== null && discount !== null && original > discount) {
    return { originalPrice: original, price: discount, discountPercent: pct };
  }
  return {
    originalPrice: null,
    price: discount ?? original,
    discountPercent: pct > 0 ? pct : null,
  };
}

/* ── Category / breadcrumb ──────────────────────────────────────── */

/** Extract the numeric Darukade category id from a breadcrumb URL, if any. */
export function categoryIdFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  const cParam = url.match(/[?&]c=(\d+)/);
  if (cParam) return Number.parseInt(cParam[1]!, 10);
  const trailing = url.match(/-(\d+)(?:[/?#]|$)/);
  if (trailing) return Number.parseInt(trailing[1]!, 10);
  return null;
}

const NON_CATEGORY_URLS = new Set(["/", "/products", ""]);

/**
 * Turn a product's breadcrumb into an ordered list of real categories,
 * dropping the breadcrumb that points at the product itself and the generic
 * "home"/"products" roots.
 */
export function categoriesFromBreadcrumb(
  breadcrumb: Array<{ title?: string | null; url?: string | null }> | null | undefined,
  productUrl?: string | null,
): NormalizedCategory[] {
  if (!breadcrumb || breadcrumb.length === 0) return [];
  const entries = breadcrumb.slice();
  // The final crumb is normally the product itself.
  if (entries.length > 1) entries.pop();
  return entries
    .filter(
      (entry) =>
        entry.url &&
        !NON_CATEGORY_URLS.has(entry.url) &&
        entry.url !== productUrl,
    )
    .map((entry) => ({
      sourceCategoryId: categoryIdFromUrl(entry.url),
      name: (entry.title ?? "").trim(),
      url: entry.url ?? null,
    }))
    .filter((entry) => entry.name.length > 0);
}

/* ── Listing summary ────────────────────────────────────────────── */

function summaryImages(image: string | null | undefined): string[] {
  const absolute = absoluteUrl(image);
  return productImages([absolute ?? ""]);
}

/** Normalize one product from a listing/search page. */
export function normalizeListingProduct(
  raw: RawListingProduct,
): NormalizedProductSummary {
  const prices = normalizePrices(
    raw.orginalCost,
    raw.discountCost,
    raw.discountPercent,
  );
  const images = summaryImages(raw.image);
  return {
    sourceProductId: raw.id,
    productUrl: absoluteUrl(raw.productURL) ?? `${DARUKADE_ORIGIN}/`,
    nameFa: (raw.faName ?? "").trim(),
    brand: raw.brandEnName?.trim() || null,
    brandUrl: raw.brandURL ?? null,
    image: images[0] ?? null,
    images,
    originalPrice: prices.originalPrice,
    price: prices.price,
    discountPercent: prices.discountPercent,
    currency: CURRENCY,
    availability: normalizeAvailability(raw.storeState),
    stockCount: toNumber(raw.storeCount),
    rating: toNumber(raw.rank),
    variantTitle: raw.slaveTitle?.trim() || null,
    variantTypeTitle: raw.slaveTypeTitle?.trim() || null,
    variantCount: toNumber(raw.slaveCount),
    quickBuy: raw.quickBuy === true,
    freeDelivery: raw.freeDelivery === true,
    isAd: raw.isADV === true,
  };
}

export interface ListingPage {
  products: NormalizedProductSummary[];
  page: number;
  totalPages: number;
  totalProducts: number;
  breadcrumb: Array<{ title: string; url: string }>;
  title: string | null;
  categoryId: string | null;
}

/** Normalize a `categoryMataData` listing payload. */
export function normalizeListing(categoryMataData: RawCategoryMataData): ListingPage {
  const filters = categoryMataData.filters?.pages ?? null;
  return {
    products: (categoryMataData.products ?? []).map(normalizeListingProduct),
    page: toNumber(filters?.currentPage) ?? 1,
    totalPages: toNumber(filters?.totalPage) ?? 1,
    totalProducts: toNumber(filters?.totalProductCount) ?? 0,
    breadcrumb: (categoryMataData.breadCrumb ?? []).map((crumb) => ({
      title: crumb.title,
      url: crumb.url,
    })),
    title: categoryMataData.title ?? null,
    categoryId: categoryMataData.categoryID ?? null,
  };
}

/* ── Variants ───────────────────────────────────────────────────── */

function flattenSlaves(
  slaves: RawSlaveGroup | RawSlaveGroup[] | null | undefined,
): RawVariant[] {
  if (!slaves) return [];
  const groups = Array.isArray(slaves) ? slaves : [slaves];
  return groups.flatMap((group) => group.items ?? []);
}

function normalizeVariant(raw: RawVariant): NormalizedVariant {
  const prices = normalizePrices(
    raw.orginalCost,
    raw.discountCost,
    raw.discountPercent,
  );
  const images = productImages(
    (raw.images ?? [])
      .map((entry) => absoluteUrl(entry.image))
      .filter((url): url is string => Boolean(url))
      .concat(absoluteUrl(raw.image) ?? []),
  );
  return {
    sourceVariantId: raw.id,
    typeId: toNumber(raw.typeID),
    title: raw.title?.trim() || null,
    productCode: raw.productCode?.trim() || null,
    color: raw.color?.trim() || null,
    isMaster: raw.isMaster === true,
    isSelected: raw.isSelected === true,
    originalPrice: prices.originalPrice,
    price: prices.price,
    discountPercent: prices.discountPercent,
    currency: CURRENCY,
    availability: normalizeAvailability(raw.storeState),
    stockCount: toNumber(raw.storeCount),
    maxSell: toNumber(raw.maxSell),
    expiration: raw.expiration?.trim() || null,
    images,
  };
}

/* ── Ingredients ────────────────────────────────────────────────── */

function normalizeIngredient(raw: RawIngredient): NormalizedIngredient | null {
  const nameEn = raw.enName?.trim() || null;
  const nameFa = raw.faName?.trim() || null;
  const rawName = nameEn ?? nameFa ?? "";
  if (!rawName) return null;
  const parsed = parseAmount(raw.amount);
  return {
    nameEn,
    nameFa,
    rawName,
    amount: parsed.amount,
    unit: parsed.unit,
    rawAmount: raw.amount?.trim() || null,
    dailyNeeded: raw.dailyNeeded?.trim() || null,
  };
}

/* ── Relationships ──────────────────────────────────────────────── */

const RELATIONSHIP_KEYS: Array<[keyof RawSection2, RelationshipKind]> = [
  ["relatedProducts", "related"],
  ["sameBrandProducts", "same_brand"],
  ["complementaryProducts", "complementary"],
  ["alternativeProducts", "alternative"],
];

function normalizeRelationships(section2: RawSection2): NormalizedRelationship[] {
  const out: NormalizedRelationship[] = [];
  for (const [key, kind] of RELATIONSHIP_KEYS) {
    const group = section2[key] as RawRelationshipGroup | null | undefined;
    const products = group?.products ?? [];
    products.forEach((product, index) => {
      if (typeof product?.id !== "number") return;
      out.push({
        relatedSourceProductId: product.id,
        kind,
        title: product.productName?.trim() || null,
        url: product.productURL ?? null,
        position: toNumber(product.rowIndex) ?? index,
      });
    });
  }
  return out;
}

/* ── Content hash ───────────────────────────────────────────────── */

/** Stable sha256 over the fields that matter for change detection. */
export function hashContent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/* ── Full product page ──────────────────────────────────────────── */

export interface NormalizeProductInput {
  section1: RawSection1;
  section2?: RawSection2 | null;
  section3?: RawSection3 | null;
  meta?: RawProductMataData | null;
}

/**
 * Normalize a full product page into a `NormalizedProductDetail`.
 *
 * The "master" variant (the one the URL points at) drives the summary price,
 * availability and images; the rest are stored as selectable variants.
 */
export function normalizeProduct(
  input: NormalizeProductInput,
): NormalizedProductDetail {
  const { section1, section2 = null, section3 = null, meta = null } = input;

  const variants = flattenSlaves(section1.slaves).map(normalizeVariant);
  const master =
    variants.find((variant) => variant.isMaster) ??
    variants.find((variant) => variant.sourceVariantId === section1.id) ??
    variants[0] ??
    null;

  // Fall back to the section1 summary when the source has no variant list.
  const fallbackPrices = normalizePrices(null, null, null);
  const price = master?.price ?? fallbackPrices.price;
  const originalPrice = master?.originalPrice ?? null;
  const discountPercent = master?.discountPercent ?? null;
  const availability = master?.availability ?? "Unknown";
  const images = master?.images ?? [];

  const breadcrumb = section1.breadCrumb ?? [];
  const productUrl = absoluteUrl(section1.productURL);

  const descriptionHtml = section3?.description ?? section1.review?.content ?? null;
  const expertReviewHtml = section3?.expertReview ?? null;

  const detail: Omit<NormalizedProductDetail, "contentHash"> = {
    sourceProductId: section1.id,
    masterId: toNumber(meta?.masterID) ?? section1.id,
    productCode: (meta?.pid ?? section1.productCode)?.trim() || null,
    productUrl: productUrl ?? `${DARUKADE_ORIGIN}/`,
    nameFa: (section1.faName ?? "").trim(),
    nameEn: section1.enName?.trim() || null,
    brand: section1.brandEnName?.trim() || null,
    brandUrl: section1.brandURL ?? null,
    image: images[0] ?? null,
    images,
    originalPrice,
    price,
    discountPercent,
    currency: CURRENCY,
    availability,
    stockCount: master?.stockCount ?? null,
    rating: toNumber(section1.rank),
    reviewCount: toNumber(section1.commentCount),
    viewCount: section1.visit?.trim() || null,
    variantTitle: null,
    variantTypeTitle: null,
    variantCount: variants.length > 0 ? variants.length - 1 : null,
    quickBuy: false,
    freeDelivery: false,
    isAd: false,
    categories: categoriesFromBreadcrumb(breadcrumb, section1.productURL ?? null),
    variants,
    ingredients: (section2?.ingredients ?? [])
      .map(normalizeIngredient)
      .filter((entry): entry is NormalizedIngredient => entry !== null),
    ingredientServing: section2?.ingredientperuse?.trim() || null,
    properties: (section2?.properties ?? []) as unknown as Json[],
    characteristics: (section2?.characteristics ?? null) as unknown as Json,
    usage: (section2?.usage ?? null) as unknown as Json,
    keepConditions: (section2?.keepConditions ?? null) as unknown as Json,
    warnings: (section2?.warning ?? null) as unknown as Json,
    usageInstructions: stripHtml(section2?.userguid) || null,
    description: stripHtml(descriptionHtml),
    descriptionHtml,
    expertReviewHtml,
    relationships: section2 ? normalizeRelationships(section2) : [],
    raw: {
      breadcrumb: breadcrumb as unknown as Json,
      properties: (section2?.properties ?? []) as unknown as Json,
      notice: (section1.notice ?? []) as unknown as Json,
      flagName: section1.flagName ?? null,
    },
  };

  return { ...detail, contentHash: hashContent(detail) };
}
