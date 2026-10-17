/**
 * Product-gate tests: the exact `products` stream event payload for each
 * safety state. These pin that disallowed cards can never reach the client,
 * independent of what retrieval returned.
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

test("emergency assessment suppresses all cards even when retrieval returned products", () => {
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

  assert.equal(emission.products.length, 0);
  assert.equal(emission.suppressed, true);
  assert.equal(emission.gateReason, "safety_blocked");
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

test("the gate never widens a blocked assessment, whatever else happens", () => {
  const emergency = assessSafety(
    extractHeuristicFacts("chest pain and can't breathe"),
    "chest pain and can't breathe",
  );
  for (const extra of [
    { products: someProducts, databaseAvailable: true },
    { products: someProducts, databaseAvailable: false },
  ]) {
    const emission = planProductEmission({
      safety: emergency,
      ...extra,
      queries: [],
      intent: "medical_symptom",
    });
    assert.equal(emission.products.length, 0);
    assert.equal(emission.suppressed, true);
  }
});
