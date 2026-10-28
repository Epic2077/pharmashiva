/**
 * Supplement-only product classification tests.
 *
 * The recommendation cards may only contain supplements; medicines and
 * cosmetics are rejected server-side. This pins the deterministic classifier
 * that enforces the rule, including the cosmetic example that historically
 * leaked into symptom results.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { classifyProductKind } from "../lib/ai/product-classification.ts";
import { makeCategory, makeProduct } from "./fixtures.ts";

test("a supplement URL prefix classifies as supplement", () => {
  const product = makeProduct({
    id: "sup-1",
    name: "Creatine",
    canonical_url: "https://darukade.com/products/supplement-creatine-171",
  });
  assert.equal(classifyProductKind(product), "supplement");
});

test("a cosmetic URL prefix classifies as cosmetic (not a supplement)", () => {
  const product = makeProduct({
    id: "cosmetic-1",
    name: "Brightening Cream",
    canonical_url: "https://darukade.com/products/cosmetic-brightening-9",
  });
  assert.equal(classifyProductKind(product), "cosmetic");
});

test("a drug/device product under /products/ classifies as medicine", () => {
  const product = makeProduct({
    id: "drug-1",
    name: "Eye Drops",
    canonical_url: "https://darukade.com/products/eye-drops-22",
  });
  assert.equal(classifyProductKind(product), "medicine");
});

test("Persian supplement category markers classify as supplement", () => {
  const product = makeProduct({
    id: "sup-2",
    name: "قرص ویتامین",
    categories: [makeCategory("مکمل")],
  });
  assert.equal(classifyProductKind(product), "supplement");
});

test("Persian cosmetic category markers classify as cosmetic", () => {
  const product = makeProduct({
    id: "cosmetic-2",
    name: "کرم روشن‌کننده",
    categories: [makeCategory("آرایشی")],
  });
  assert.equal(classifyProductKind(product), "cosmetic");
});
