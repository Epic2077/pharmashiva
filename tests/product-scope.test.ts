/**
 * Explicit product-scope policy tests (lib/ai/product-scope.ts).
 *
 * The recommendation scope is the single source of truth for what may be
 * recommended: supplements + OTC medicines for symptom/supplement shopping,
 * cosmetics excluded; beauty shopping defers to the relevance gate.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { productScope, scopeDecision } from "../lib/ai/product-scope.ts";
import { makeProduct } from "./fixtures.ts";

test("a supplement URL prefix maps to the supplement scope", () => {
  const product = makeProduct({
    id: "sup-1",
    canonical_url: "https://darukade.com/products/supplement-creatine-171",
  });
  assert.equal(productScope(product), "supplement");
});

test("an OTC eye drop maps to the medicine scope", () => {
  const product = makeProduct({
    id: "eye-drops-1",
    canonical_url: "https://darukade.com/products/eye-drops-22",
  });
  assert.equal(productScope(product), "medicine");
});

test("cosmetics are excluded for symptom shopping", () => {
  const decision = scopeDecision("cosmetic", "medical_symptom");
  assert.equal(decision.eligible, false);
  if (!decision.eligible) assert.equal(decision.code, "cosmetic_excluded");
});

test("cosmetics are excluded for supplement shopping too", () => {
  const decision = scopeDecision("cosmetic", "supplement");
  assert.equal(decision.eligible, false);
});

test("OTC medicines and supplements are eligible for symptom shopping", () => {
  assert.equal(scopeDecision("medicine", "medical_symptom").eligible, true);
  assert.equal(scopeDecision("supplement", "medical_symptom").eligible, true);
  assert.equal(scopeDecision("unknown", "medical_symptom").eligible, true);
});

test("beauty shopping defers scope separation to the relevance gate", () => {
  // scopeDecision only enforces the symptom/supplement cosmetic exclusion;
  // beauty/general intents are separated by the gate's candidateScope check.
  assert.equal(scopeDecision("cosmetic", "beauty").eligible, true);
  assert.equal(scopeDecision("supplement", "beauty").eligible, true);
});
