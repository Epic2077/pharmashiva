/**
 * Shared deterministic fixtures for the safety/relevance tests. No live AI,
 * no network — every scenario is reproducible.
 */

import type { CaseFacts } from "@/types/ai";
import type {
  CategoryRef,
  IngredientRef,
  ProductDetails,
} from "@/types/database";

export function makeFacts(overrides: Partial<CaseFacts> = {}): CaseFacts {
  return {
    summary: "",
    symptoms: [],
    goal: null,
    category: null,
    allergies: [],
    conditions: [],
    medications: [],
    age: null,
    pregnancy: null,
    duration: null,
    customerName: null,
    missingInformation: [],
    statedFacts: [],
    inferredFacts: [],
    searchTerms: [],
    productQueries: [],
    ...overrides,
  };
}

export function makeCategory(name: string): CategoryRef {
  return {
    id: name,
    name,
    slug: null,
    parent_id: null,
    parent_name: null,
    breadcrumbs: null,
  };
}

export function makeIngredient(
  name: string,
  extras: Partial<IngredientRef> = {},
): IngredientRef {
  return {
    name,
    name_en: name,
    name_fa: null,
    amount: null,
    unit: null,
    form: null,
    raw_name: null,
    ...extras,
  };
}

export function makeProduct(
  overrides: Partial<ProductDetails> & { id: string },
): ProductDetails {
  return {
    source_id: "darukade",
    source_page_id: null,
    canonical_url: null,
    name: "",
    name_en: null,
    name_fa: null,
    slug: null,
    brand: null,
    description: null,
    sku: null,
    barcode: null,
    price: null,
    currency: "IRT",
    availability: "InStock",
    manufacturer: null,
    form: null,
    package_size: null,
    image_urls: null,
    attributes: null,
    source_payload: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ingredients: [],
    categories: [],
    detailLoaded: false,
    ...overrides,
  };
}

/** The failure-case product: a dark-spot brightening serum. */
export function ageBrightAndSpotFader(): ProductDetails {
  return makeProduct({
    id: "age-bright-1",
    name: "Age Bright and Spot Fader",
    name_en: "Age Bright and Spot Fader",
    brand: "BrightLab",
    categories: [
      makeCategory("Skincare"),
      makeCategory("Dark spot treatment"),
      makeCategory("Brightening"),
    ],
    ingredients: [makeIngredient("Vitamin C"), makeIngredient("Niacinamide")],
    detailLoaded: true,
  });
}

/** A plausibly relevant eye product for eye symptoms. */
export function lubricantEyeDrops(): ProductDetails {
  return makeProduct({
    id: "eye-drops-1",
    name: "Lubricant Eye Drops",
    name_en: "Lubricant Eye Drops",
    brand: "OptiCare",
    categories: [makeCategory("Eye care"), makeCategory("Eye drops")],
    ingredients: [makeIngredient("Hypromellose")],
    detailLoaded: true,
  });
}
