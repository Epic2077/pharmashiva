/**
 * Verified product classification for the supplement-only recommendation rule.
 *
 * Darukade segments its catalog with stable URL slug prefixes — supplements
 * live under `/products/supplement-…` and cosmetics under
 * `/products/cosmetic-…`. Anything else under `/products/` (analgesics, eye
 * drops, cough syrups, medical devices, …) is a non-supplement product.
 *
 * Classification only ever relies on source-verified fields (the canonical URL
 * and the category names the source publishes). It never guesses from a name.
 */

import type { ProductDetails } from "@/types/database";

export type ProductKind = "supplement" | "cosmetic" | "medicine" | "unknown";

/** Category-name markers that identify a supplement regardless of URL prefix. */
const SUPPLEMENT_MARKERS = [
  "supplement",
  "مکمل",
  "ویتامین",
  "vitamin",
  "multivitamin",
  "مولتی ویتامین",
  "پروتئین",
  "protein",
  "امگا",
  "omega",
  "آمینو",
  "amino",
  "مینرال",
  "mineral",
  "پروبیوتیک",
  "probiotic",
];

/** Category-name markers that identify a cosmetic product. */
const COSMETIC_MARKERS = [
  "cosmetic",
  "آرایشی",
  "بهداشتی",
  "beauty",
  "makeup",
];

export function classifyProductKind(product: ProductDetails): ProductKind {
  const path = (product.canonical_url ?? "").toLowerCase();

  // The most reliable, source-verified signal: Darukade's own slug prefixes.
  if (path.includes("/supplement-")) return "supplement";
  if (path.includes("/cosmetic-")) return "cosmetic";

  const categoryText = product.categories
    .map((category) =>
      [category.name, category.slug ?? "", ...(category.breadcrumbs ?? [])].join(
        " ",
      ),
    )
    .join(" ")
    .toLowerCase();

  if (SUPPLEMENT_MARKERS.some((marker) => categoryText.includes(marker))) {
    return "supplement";
  }
  if (COSMETIC_MARKERS.some((marker) => categoryText.includes(marker))) {
    return "cosmetic";
  }

  // A product under /products/ that is neither a supplement nor a cosmetic is
  // a drug or medical-device category on the source. The canonical URL is
  // absolute (https://darukade.com/products/…), so use `includes`, not a
  // leading-slash `startsWith`.
  if (path.includes("/products/")) return "medicine";

  return "unknown";
}
