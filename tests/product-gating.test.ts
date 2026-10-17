/**
 * Product-emission tests: the exact `products` stream event payload for each
 * safety state. Product cards are always shown — the safety assessment is
 * advisory and never suppresses them — so these pin that cards always pass
 * through and are only flagged `provisional` when the case is not routine.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assessSafety } from "../lib/safety/red-flags.ts";
import { planProductEmission } from "../lib/ai/product-gating.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import {
  ageBrightAndSpotFader,
  lubricantEyeDrops,
  makeFacts,
} from "./fixtures.ts";

const someProducts = [
  {
    product: ageBrightAndSpotFader(),
    categoryName: "Skincare",
    reason: "x",
    compatibility: "compatible" as const,
    warnings: [],
    score: 1,
    provisional: false,
  },
  {
    product: lubricantEyeDrops(),
    categoryName: "Eye drops",
    reason: "x",
    compatibility: "compatible" as const,
    warnings: [],
    score: 2,
    provisional: false,
  },
];

test("emergency assessment still shows the retrieved cards (provisional)", () => {
  const safety = assessSafety(
    extractHeuristicFacts("A chemical splashed into my eye."),
    "A chemical splashed into my eye.",
  );
  const emission = planProductEmission({
    safety,
    products: someProducts,
    databaseAvailable: true,
    queries: ["eye drops"],
    intent: "medical_symptom",
  });

  assert.equal(safety.level, "emergency");
  assert.equal(emission.products.length, 2);
  assert.equal(emission.suppressed, false);
  assert.equal(emission.gateReason, null);
  assert.equal(emission.provisional, true);
});

test("caution assessment shows cards as provisional instead of suppressing", () => {
  const safety = assessSafety(
    extractHeuristicFacts("Ali's eyes are red."),
    "Ali's eyes are red.",
  );
  const emission = planProductEmission({
    safety,
    products: someProducts,
    databaseAvailable: true,
    queries: ["eye drops"],
    intent: "medical_symptom",
  });

  assert.equal(emission.suppressed, false);
  assert.equal(emission.products.length, 2);
  assert.equal(emission.provisional, true);
  assert.equal(emission.gateReason, null);
});

test("routine assessment passes the cards through", () => {
  const safety = assessSafety(
    makeFacts({ goal: "moisturizer" }),
    "I want a moisturizer.",
  );
  const emission = planProductEmission({
    safety,
    products: someProducts,
    databaseAvailable: true,
    queries: ["moisturizer"],
    intent: "beauty",
  });

  assert.equal(emission.suppressed, false);
  assert.equal(emission.products.length, 2);
  assert.equal(emission.gateReason, null);
});

test("an insufficient-information request still shows retrieved cards", () => {
  const safety = assessSafety(
    extractHeuristicFacts("Recommend a supplement for my symptom."),
    "Recommend a supplement for my symptom.",
  );
  const emission = planProductEmission({
    safety,
    products: someProducts,
    databaseAvailable: true,
    queries: [],
    intent: "general",
  });

  assert.equal(emission.suppressed, false);
  assert.equal(emission.products.length, 2);
  assert.equal(emission.provisional, true);
});

test("cards are shown for every safety level, whatever else happens", () => {
  for (const scenario of [
    "chest pain and can't breathe",
    "A chemical splashed into my eye.",
    "Ali's eyes are red.",
    "I want a moisturizer.",
  ]) {
    const safety = assessSafety(
      extractHeuristicFacts(scenario),
      scenario,
    );
    for (const extra of [
      { products: someProducts, databaseAvailable: true },
      { products: someProducts, databaseAvailable: false },
    ]) {
      const emission = planProductEmission({
        safety,
        ...extra,
        queries: [],
        intent: "medical_symptom",
      });
      assert.equal(emission.products.length, 2, scenario);
      assert.equal(emission.suppressed, false, scenario);
      assert.equal(emission.gateReason, null, scenario);
    }
  }
});
