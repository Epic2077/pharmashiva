/**
 * Deterministic relevance-gate tests (fixtures only).
 *
 * The explicit negative example — "Age Bright and Spot Fader" for
 * "Ali's eyes are red" — is covered here, but through the general gate, not a
 * one-off exclusion.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCandidateRelevance,
  filterCandidatesByRelevance,
  inferShoppingIntent,
  meaningfulQueryTokens,
  symptomDomains,
} from "../lib/ai/relevance-gate.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import {
  ageBrightAndSpotFader,
  lubricantEyeDrops,
  makeCategory,
  makeFacts,
  makeProduct,
} from "./fixtures.ts";

const eyeFacts = makeFacts({
  symptoms: ["red eye", "eye redness"],
  searchTerms: ["red eyes"],
  productQueries: ["eye drops"],
});

test("Age Bright and Spot Fader is rejected for 'Ali's eyes are red.'", () => {
  const verdict = evaluateCandidateRelevance({
    product: ageBrightAndSpotFader(),
    queryTokens: meaningfulQueryTokens(["eye drops"]),
    domains: symptomDomains(eyeFacts),
    intent: "medical_symptom",
  });

  assert.equal(verdict.pass, false);
  assert.equal(verdict.code, "intended_use_mismatch");
});

test("a relevant eye product passes the same gate", () => {
  const verdict = evaluateCandidateRelevance({
    product: lubricantEyeDrops(),
    queryTokens: meaningfulQueryTokens(["eye drops"]),
    domains: symptomDomains(eyeFacts),
    intent: "medical_symptom",
  });

  assert.equal(verdict.pass, true);
  assert.ok(verdict.matchedTokens.length > 0);
});

test("an eye product can pass by symptom domain even without query overlap", () => {
  // "red eyes" query tokens do not overlap "ophthalmic solution", but the
  // eye-domain match justifies the candidate for an eye symptom.
  const ophthalmic = makeProduct({
    id: "oph-1",
    name: "Ophthalmic Solution",
    name_en: "Ophthalmic Solution",
    categories: [makeCategory("Ophthalmic")],
    detailLoaded: true,
  });
  const verdict = evaluateCandidateRelevance({
    product: ophthalmic,
    queryTokens: meaningfulQueryTokens(["red eyes"]),
    domains: symptomDomains(eyeFacts),
    intent: "medical_symptom",
  });

  assert.equal(verdict.pass, true);
});

test("unrelated products are rejected for other symptoms too (generic gate)", () => {
  const facts = makeFacts({ symptoms: ["headache"], productQueries: [] });
  const shampoo = makeProduct({
    id: "shampoo-1",
    name: "Herbal Shampoo",
    name_en: "Herbal Shampoo",
    categories: [makeCategory("Hair care"), makeCategory("Shampoo")],
    detailLoaded: true,
  });
  const verdict = evaluateCandidateRelevance({
    product: shampoo,
    queryTokens: meaningfulQueryTokens(["headache"]),
    domains: symptomDomains(facts),
    intent: "medical_symptom",
  });

  assert.equal(verdict.pass, false);
  assert.equal(verdict.code, "intended_use_mismatch");
});

test("a dark-spot beauty request must not return supplements (scope_mismatch)", () => {
  const facts = makeFacts({
    goal: "I want a product for dark spots.",
    productQueries: ["collagen serum"],
  });
  const supplement = makeProduct({
    id: "supp-1",
    name: "Collagen Supplement",
    name_en: "Collagen Supplement",
    categories: [makeCategory("Supplements"), makeCategory("Collagen")],
    detailLoaded: true,
  });
  const verdict = evaluateCandidateRelevance({
    product: supplement,
    queryTokens: meaningfulQueryTokens(["collagen serum"]),
    domains: [],
    intent: inferShoppingIntent(facts, "I want a product for dark spots."),
  });

  assert.equal(verdict.pass, false);
  assert.equal(verdict.code, "scope_mismatch");
});

test("a beauty product for the same dark-spot request passes", () => {
  const facts = makeFacts({
    goal: "I want a product for dark spots.",
    productQueries: ["collagen serum"],
  });
  const serum = makeProduct({
    id: "serum-1",
    name: "Collagen Serum",
    name_en: "Collagen Serum",
    categories: [makeCategory("Skincare"), makeCategory("Serum")],
    detailLoaded: true,
  });
  const verdict = evaluateCandidateRelevance({
    product: serum,
    queryTokens: meaningfulQueryTokens(["collagen serum"]),
    domains: [],
    intent: inferShoppingIntent(facts, "I want a product for dark spots."),
  });

  assert.equal(verdict.pass, true);
});

test("weak colour tokens never count as overlap", () => {
  const lipstick = makeProduct({
    id: "lipstick-1",
    name: "Red Lipstick",
    name_en: "Red Lipstick",
    categories: [makeCategory("Makeup")],
    detailLoaded: true,
  });
  const verdict = evaluateCandidateRelevance({
    product: lipstick,
    queryTokens: meaningfulQueryTokens(["red eyes"]),
    domains: symptomDomains(eyeFacts),
    intent: "medical_symptom",
  });

  assert.equal(verdict.pass, false);
});

test("no queryable intent rejects every candidate", () => {
  const result = filterCandidatesByRelevance({
    products: [ageBrightAndSpotFader(), lubricantEyeDrops()],
    queries: [],
    facts: makeFacts(),
    intent: "general",
  });

  assert.equal(result.kept.length, 0);
  assert.equal(result.excluded.length, 2);
  assert.ok(
    result.excluded.every((verdict) => verdict.code === "no_queryable_intent"),
  );
});

test("intent inference separates symptom, supplement and beauty shopping", () => {
  assert.equal(
    inferShoppingIntent(makeFacts({ symptoms: ["red eye"] }), "eyes are red"),
    "medical_symptom",
  );
  assert.equal(
    inferShoppingIntent(makeFacts(), "I want a vitamin supplement"),
    "supplement",
  );
  assert.equal(
    inferShoppingIntent(makeFacts(), "I want a moisturizer"),
    "beauty",
  );
  assert.equal(inferShoppingIntent(makeFacts(), "hello"), "general");
});

test("sentence noise is never a usable query", () => {
  const facts = extractHeuristicFacts("Ali's eyes are red.");
  // Heuristics no longer store the raw sentence as a search term.
  assert.ok(
    !facts.searchTerms.some((term) => term.includes("ali")),
    "raw sentence must not be a search term",
  );
  // And even if a sentence-like string is forced in, only "eyes" survives.
  const tokens = meaningfulQueryTokens(["ali's eyes are red"]);
  assert.deepEqual(tokens, ["eyes"]);
});
