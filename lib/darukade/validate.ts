/**
 * Runtime validation of raw Darukade payloads.
 *
 * TypeScript interfaces describe shapes; they do not validate them. Every
 * payload that crosses the network is coerced here: entries with missing or
 * malformed identity fields are dropped, everything else is passed through
 * with the same semantics the normalizer expects. The whole payload being
 * unusable is the only fatal case (`ParseError`).
 */

import { ParseError } from "./errors.ts";
import type {
  Json,
  RawCategoryMataData,
  RawHeaderFooterData,
  RawIngredient,
  RawListingFilters,
  RawListingProduct,
  RawMenuNode,
  RawProductMataData,
  RawProperty,
  RawRelationshipGroup,
  RawRelationshipProduct,
  RawSection1,
  RawSection2,
  RawSection3,
  RawSlaveGroup,
  RawVariant,
  RawVariantImage,
} from "./types.ts";

export interface RawBreadcrumb {
  id: number;
  title: string;
  url: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function breadcrumbEntries(value: unknown): RawBreadcrumb[] {
  return asArray(value).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const title = asString(entry.title) ?? "";
    const url = asString(entry.url) ?? "";
    if (!title && !url) return [];
    return [{ id: asNumber(entry.id) ?? 0, title, url }];
  });
}

/* ── Listing ───────────────────────────────────────────────────── */

/** Validate one product entry from `categoryMataData.products`. */
export function validateListingProduct(
  value: unknown,
): RawListingProduct | null {
  if (!isObject(value)) return null;
  const id = asNumber(value.id);
  const faName = asString(value.faName);
  const productURL = asString(value.productURL);
  if (id === null || !faName || !productURL) return null;
  return {
    id,
    faName,
    productURL,
    image: asString(value.image),
    brandEnName: asString(value.brandEnName),
    brandURL: asString(value.brandURL),
    rank: asNumber(value.rank),
    slaveTitle: asString(value.slaveTitle),
    slaveTypeID: asNumber(value.slaveTypeID),
    slaveTypeTitle: asString(value.slaveTypeTitle),
    slaveCount: asNumber(value.slaveCount),
    orginalCost: asNumber(value.orginalCost),
    discountCost: asNumber(value.discountCost),
    discountPercent: asNumber(value.discountPercent),
    storeState: asBoolean(value.storeState),
    storeCount: asNumber(value.storeCount),
    quickBuy: asBoolean(value.quickBuy),
    hasGift: asBoolean(value.hasGift),
    isADV: asBoolean(value.isADV),
    freeDelivery: asBoolean(value.freeDelivery),
  };
}

function listingFilters(value: unknown): RawListingFilters | null {
  if (!isObject(value)) return null;
  const pages = isObject(value.pages) ? value.pages : null;
  return {
    pages: pages
      ? {
          totalPage: asNumber(pages.totalPage) ?? undefined,
          currentPage: asNumber(pages.currentPage) ?? undefined,
          pageProductCount: asNumber(pages.pageProductCount) ?? undefined,
          totalProductCount: asNumber(pages.totalProductCount) ?? undefined,
          querystring: asString(pages.querystring) ?? undefined,
        }
      : null,
  };
}

/**
 * Validate the `categoryMataData` listing payload. Throws `ParseError` only
 * when the payload itself is missing/not an object; invalid product entries
 * are dropped individually.
 */
export function validateListingPayload(
  value: unknown,
  url: string,
): RawCategoryMataData {
  if (!isObject(value)) {
    throw new ParseError("Listing payload is not an object", url);
  }
  const products = asArray(value.products)
    .map(validateListingProduct)
    .filter((product): product is RawListingProduct => product !== null);
  return {
    title: asString(value.title),
    breadCrumb: breadcrumbEntries(value.breadCrumb),
    filters: listingFilters(value.filters),
    products,
    categoryID: asString(value.categoryID),
    url: asString(value.url),
    description: asString(value.description),
  };
}

/* ── Product page sections ─────────────────────────────────────── */

function variantImages(value: unknown): RawVariantImage[] {
  return asArray(value).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const image = asString(entry.image);
    if (!image) return [];
    return [
      {
        id: asNumber(entry.id) ?? undefined,
        image,
        videoURL: asString(entry.videoURL),
        type: asNumber(entry.type),
      },
    ];
  });
}

function validateVariant(value: unknown): RawVariant | null {
  if (!isObject(value)) return null;
  const id = asNumber(value.id);
  if (id === null) return null;
  return {
    id,
    productCode: asString(value.productCode),
    typeID: asNumber(value.typeID),
    isSelected: asBoolean(value.isSelected),
    isMaster: asBoolean(value.isMaster),
    title: asString(value.title),
    image: asString(value.image),
    color: asString(value.color),
    orginalCost: asNumber(value.orginalCost),
    discountCost: asNumber(value.discountCost),
    discountPercent: asNumber(value.discountPercent),
    storeState: asBoolean(value.storeState),
    storeCount: asNumber(value.storeCount),
    maxSell: asNumber(value.maxSell),
    expiration: asString(value.expiration),
    images: variantImages(value.images),
    freeDelivery: asBoolean(value.freeDelivery),
  };
}

function validateSlaves(
  value: unknown,
): RawSlaveGroup | RawSlaveGroup[] | null {
  if (!value) return null;
  const groups = Array.isArray(value) ? value : [value];
  const validated = groups.flatMap((entry) => {
    if (!isObject(entry)) return [];
    const items = asArray(entry.items)
      .map(validateVariant)
      .filter((item): item is RawVariant => item !== null);
    if (items.length === 0) return [];
    return [
      {
        id: asNumber(entry.id) ?? undefined,
        title: asString(entry.title),
        variety: asString(entry.variety),
        items,
      },
    ];
  });
  return validated.length > 0 ? validated : null;
}

function validateIngredients(value: unknown): RawIngredient[] {
  return asArray(value).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const enName = asString(entry.enName);
    const faName = asString(entry.faName);
    if (!enName && !faName) return [];
    return [
      {
        id: asNumber(entry.id) ?? undefined,
        enName,
        faName,
        amount: asString(entry.amount),
        dailyNeeded: asString(entry.dailyNeeded),
      },
    ];
  });
}

function validateProperties(value: unknown): RawProperty[] {
  return asArray(value).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const title = asString(entry.title);
    if (!title) return [];
    return [
      {
        id: asNumber(entry.id) ?? undefined,
        title,
        value: asString(entry.value),
        url: asString(entry.url),
      },
    ];
  });
}

function validateRelationshipGroup(
  value: unknown,
): RawRelationshipGroup | null {
  if (!isObject(value)) return null;
  const products = asArray(value.products).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const id = asNumber(entry.id);
    const productName = asString(entry.productName);
    if (id === null || !productName) return [];
    const out: RawRelationshipProduct = {
      id,
      productID: asNumber(entry.productID) ?? undefined,
      rowIndex: asNumber(entry.rowIndex),
      image: asString(entry.image),
      productName,
      productURL: asString(entry.productURL),
      cost: asNumber(entry.cost),
      orginalCost: asNumber(entry.orginalCost),
      discountPercent: asNumber(entry.discountPercent),
      storeState: asBoolean(entry.storeState),
      brandName: asString(entry.brandName),
      brandURL: asString(entry.brandURL),
      rank: asNumber(entry.rank),
    };
    return [out];
  });
  return {
    id: asNumber(value.id) ?? undefined,
    title: asString(value.title),
    products: products.length > 0 ? products : null,
  };
}

export interface ValidatedProductPage {
  section1: RawSection1;
  section2: RawSection2 | null;
  section3: RawSection3 | null;
  meta: RawProductMataData | null;
}

/**
 * Validate the four page-props sections of a product page. The `section1Data`
 * payload is required (with a numeric id and a name); the others degrade to
 * `null` when malformed.
 */
export function validateProductPage(
  pageProps: unknown,
  url: string,
): ValidatedProductPage {
  if (!isObject(pageProps)) {
    throw new ParseError("Product payload missing `pageProps`", url);
  }
  const section1Raw = pageProps.section1Data;
  if (!isObject(section1Raw)) {
    throw new ParseError("Product payload missing `section1Data`", url);
  }
  const id = asNumber(section1Raw.id);
  const faName = asString(section1Raw.faName);
  if (id === null || !faName) {
    throw new ParseError("Product payload has no id/name", url);
  }

  const section1: RawSection1 = {
    id,
    productCode: asString(section1Raw.productCode),
    faName,
    enName: asString(section1Raw.enName),
    productURL: asString(section1Raw.productURL),
    breadCrumb: breadcrumbEntries(section1Raw.breadCrumb),
    brandID: asNumber(section1Raw.brandID),
    brandFaName: asString(section1Raw.brandFaName),
    brandEnName: asString(section1Raw.brandEnName),
    brandURL: asString(section1Raw.brandURL),
    visit: asString(section1Raw.visit),
    rank: asNumber(section1Raw.rank),
    satisfyPercent: asNumber(section1Raw.satisfyPercent),
    commentCount: asNumber(section1Raw.commentCount),
    viewPointCount: asNumber(section1Raw.viewPointCount),
    slaves: validateSlaves(section1Raw.slaves),
    review: isObject(section1Raw.review)
      ? {
          title: asString(section1Raw.review.title),
          content: asString(section1Raw.review.content),
        }
      : null,
    notice: asArray(section1Raw.notice) as Json[],
    flagName: asString(section1Raw.flagName),
  };

  const section2Raw = isObject(pageProps.section2Data)
    ? pageProps.section2Data
    : null;
  const section2: RawSection2 | null = section2Raw
    ? {
        relatedProducts: validateRelationshipGroup(section2Raw.relatedProducts),
        sameBrandProducts: validateRelationshipGroup(
          section2Raw.sameBrandProducts,
        ),
        complementaryProducts: validateRelationshipGroup(
          section2Raw.complementaryProducts,
        ),
        alternativeProducts: validateRelationshipGroup(
          section2Raw.alternativeProducts,
        ),
        properties: validateProperties(section2Raw.properties),
        characteristics: isObject(section2Raw.characteristics)
          ? (section2Raw.characteristics as unknown as RawSection2["characteristics"])
          : null,
        usage: isObject(section2Raw.usage)
          ? (section2Raw.usage as unknown as RawSection2["usage"])
          : null,
        keepConditions: isObject(section2Raw.keepConditions)
          ? (section2Raw.keepConditions as unknown as RawSection2["keepConditions"])
          : null,
        warning: isObject(section2Raw.warning)
          ? (section2Raw.warning as unknown as RawSection2["warning"])
          : null,
        userguid: asString(section2Raw.userguid),
        ingredients: validateIngredients(section2Raw.ingredients),
        ingredientperuse: asString(section2Raw.ingredientperuse),
      }
    : null;

  const section3Raw = isObject(pageProps.section3Data)
    ? pageProps.section3Data
    : null;
  const section3: RawSection3 | null = section3Raw
    ? {
        description: asString(section3Raw.description),
        expertReview: asString(section3Raw.expertReview),
        faq: asArray(section3Raw.faq) as Json[],
        videos: asArray(section3Raw.videos) as Json[],
      }
    : null;

  const metaRaw = isObject(pageProps.productMataData)
    ? pageProps.productMataData
    : null;
  const meta: RawProductMataData | null = metaRaw
    ? {
        id: asNumber(metaRaw.id) ?? undefined,
        masterID: asNumber(metaRaw.masterID) ?? undefined,
        pid: asString(metaRaw.pid),
      }
    : null;

  return { section1, section2, section3, meta };
}

/* ── Header navigation (category hierarchy) ────────────────────── */

function validateMenuNode(value: unknown): RawMenuNode | null {
  if (!isObject(value)) return null;
  const title = asString(value.title);
  const url = asString(value.url);
  if (!title || !url) return null;
  return {
    id: asNumber(value.id),
    title,
    url,
    icon: asString(value.icon),
    rowIndex: asNumber(value.rowIndex),
    childs: asArray(value.childs)
      .map(validateMenuNode)
      .filter((node): node is RawMenuNode => node !== null),
  };
}

/** Validate the `headerFooterData` payload and extract the menu tree. */
export function validateHeaderMenus(value: unknown): RawMenuNode[] {
  if (!isObject(value)) return [];
  const header = isObject(value.header) ? value.header : null;
  if (!header) return [];
  return asArray(header.menus)
    .map(validateMenuNode)
    .filter((node): node is RawMenuNode => node !== null);
}

export function validateHeaderFooterData(value: unknown): RawHeaderFooterData {
  if (!isObject(value)) return { header: null };
  return { header: { menus: validateHeaderMenus(value) } };
}
