/**
 * Retrieval integration tests with mocked Darukade responses (no network).
 *
 * The pipeline's retrieval layer is exercised end-to-end: query building,
 * merging, enrichment, allergy hard-filter, relevance gate, ranking and the
 * final recommendation shape.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  retrieveProducts,
  type RetrievalDependencies,
} from "../lib/ai/product-retrieval.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import type { ProductDetails } from "@/types/database";
import {
  ageBrightAndSpotFader,
  lubricantEyeDrops,
  makeCategory,
  makeFacts,
  makeIngredient,
  makeProduct,
} from "./fixtures.ts";

const signal = new AbortController().signal;

function searchReturning(
  hits: Array<{ product: ProductDetails; rank: number }>,
) {
  return async () => ({ hits });
}

function enrichPassthrough() {
  return async (products: ProductDetails[]) => ({ products });
}

function localizeIdentity() {
  return async (category: { name: string } | undefined) =>
    category?.name ?? null;
}

const eyeDropsQueryFacts = makeFacts({
  symptoms: ["red eye"],
  productQueries: ["eye drops"],
});

test("irrelevant catalog results are rejected — no product cards", async () => {
  let searched = 0;
  const dependencies: RetrievalDependencies = {
    search: async (query, options) => {
      searched += 1;
      void options;
      void query;
      return { hits: [{ product: ageBrightAndSpotFader(), rank: 1 }] };
    },
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts: eyeDropsQueryFacts,
    message: "Ali's eyes are red.",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(searched, 1);
  assert.equal(result.databaseAvailable, true);
  assert.equal(result.products.length, 0);
  assert.ok(
    result.decisions.some(
      (verdict) =>
        verdict.productId === "age-bright-1" &&
        verdict.code === "intended_use_mismatch",
    ),
    "machine-readable rejection reason must be recorded",
  );
});

test("relevant candidates pass and keep a traceable reason", async () => {
  const dependencies: RetrievalDependencies = {
    search: searchReturning([
      { product: ageBrightAndSpotFader(), rank: 0.5 },
      { product: lubricantEyeDrops(), rank: 0.9 },
    ]),
    enrich: enrichPassthrough(),
    localizeCategory: async (category) => {
      if (!category) return null;
      return `${category.name} (localized)`;
    },
  };

  const result = await retrieveProducts({
    facts: eyeDropsQueryFacts,
    message: "Ali's eyes are red.",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].product.id, "eye-drops-1");
  assert.equal(result.products[0].categoryName, "Eye care (localized)");
  assert.ok(result.products[0].reason.includes("eye drops"));
});

test("known allergen ingredient is a hard exclusion (allergy_conflict)", async () => {
  const withAspirin = makeProduct({
    ...lubricantEyeDrops(),
    ingredients: [makeIngredient("Aspirin")],
    detailLoaded: true,
  });
  const facts = makeFacts({
    symptoms: ["red eye"],
    productQueries: ["eye drops"],
    allergies: ["aspirin"],
  });
  const dependencies: RetrievalDependencies = {
    search: searchReturning([{ product: withAspirin, rank: 1 }]),
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "I am allergic to aspirin. Does this product contain it?",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.products.length, 0);
  assert.ok(
    result.decisions.some(
      (verdict) =>
        verdict.productId === withAspirin.id &&
        verdict.code === "allergy_conflict",
    ),
  );
});

test("missing ingredient data is reported, never assumed safe", async () => {
  const listingOnly = makeProduct({
    id: "drops-listing-only",
    name: "Lubricant Eye Drops",
    name_en: "Lubricant Eye Drops",
    categories: [makeCategory("Eye drops")],
    ingredients: [],
    detailLoaded: false,
  });
  const facts = makeFacts({
    symptoms: ["red eye"],
    productQueries: ["eye drops"],
    allergies: ["aspirin"],
  });
  const dependencies: RetrievalDependencies = {
    search: searchReturning([{ product: listingOnly, rank: 1 }]),
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "Does this product contain aspirin?",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.missingIngredientData, true);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].compatibility, "unknown");
  assert.ok(
    result.products[0].warnings.some((warning) =>
      warning.includes("cannot be confirmed"),
    ),
  );
});

test("legacy sentence search terms never reach the catalog", async () => {
  let searched = 0;
  const facts = extractHeuristicFacts("Ali's eyes are red.");
  const dependencies: RetrievalDependencies = {
    search: async () => {
      searched += 1;
      return { hits: [{ product: ageBrightAndSpotFader(), rank: 1 }] };
    },
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "Ali's eyes are red.",
    language: "en",
    provisional: true,
    signal,
    dependencies,
  });

  assert.equal(searched, 0);
  assert.equal(result.noQueryableIntent, true);
  assert.equal(result.products.length, 0);
});

test("beauty shopping is kept in the beauty scope (supplements excluded)", async () => {
  const moisturizer = makeProduct({
    id: "moist-1",
    name: "Daily Moisturizer Cream",
    name_en: "Daily Moisturizer Cream",
    categories: [makeCategory("Skincare"), makeCategory("Moisturizers")],
    detailLoaded: true,
  });
  const supplement = makeProduct({
    id: "supp-1",
    name: "Vitamin C Supplement",
    name_en: "Vitamin C Supplement",
    categories: [makeCategory("Supplements"), makeCategory("Vitamins")],
    detailLoaded: true,
  });
  const facts = makeFacts({ productQueries: ["moisturizer"] });
  const dependencies: RetrievalDependencies = {
    search: searchReturning([
      { product: supplement, rank: 1 },
      { product: moisturizer, rank: 0.8 },
    ]),
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "I have mild dry skin and want a moisturizer.",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.scope, "beauty");
  assert.deepEqual(
    result.products.map((item) => item.product.id),
    ["moist-1"],
  );
});

test("catalog failure is reported, never masked as no-results", async () => {
  const dependencies: RetrievalDependencies = {
    search: async () => {
      throw new Error("network down");
    },
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts: eyeDropsQueryFacts,
    message: "Ali's eyes are red.",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.databaseAvailable, false);
  assert.equal(result.products.length, 0);
});

test("zinc allergy filters out zinc-containing products and keeps others", async () => {
  const withZinc = makeProduct({
    id: "zinc-1",
    name: "Zinc Oxide Ointment",
    name_en: "Zinc Oxide Ointment",
    categories: [makeCategory("Skincare")],
    ingredients: [makeIngredient("Zinc Oxide")],
    detailLoaded: true,
  });
  const withoutZinc = makeProduct({
    id: "cream-1",
    name: "Soothing Cream",
    name_en: "Soothing Cream",
    categories: [makeCategory("Skincare"), makeCategory("Moisturizers")],
    ingredients: [makeIngredient("Glycerin")],
    detailLoaded: true,
  });
  const facts = makeFacts({
    allergies: ["zinc"],
    symptoms: ["acne"],
    productQueries: ["soothing cream"],
  });
  const dependencies: RetrievalDependencies = {
    search: searchReturning([
      { product: withZinc, rank: 1 },
      { product: withoutZinc, rank: 0.9 },
    ]),
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "my client is allergic to zinc and has acne",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.deepEqual(
    result.products.map((item) => item.product.id),
    ["cream-1"],
  );
  assert.ok(
    result.decisions.some(
      (verdict) =>
        verdict.productId === "zinc-1" && verdict.code === "allergy_conflict",
    ),
  );
});

test("medicines present → interaction-verification warning attached", async () => {
  const facts = makeFacts({
    symptoms: ["red eye"],
    productQueries: ["eye drops"],
    medications: ["warfarin"],
  });
  const dependencies: RetrievalDependencies = {
    search: searchReturning([{ product: lubricantEyeDrops(), rank: 1 }]),
    enrich: enrichPassthrough(),
    localizeCategory: localizeIdentity(),
  };

  const result = await retrieveProducts({
    facts,
    message: "client uses warfarin, is this eye drop good to use?",
    language: "en",
    provisional: false,
    signal,
    dependencies,
  });

  assert.equal(result.products.length, 1);
  assert.ok(
    result.products[0].warnings.some((warning) =>
      warning.toLowerCase().includes("not been verified"),
    ),
  );
});
