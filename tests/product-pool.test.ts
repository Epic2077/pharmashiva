/**
 * Candidate-pooling tests (lib/ai/product-pool.ts).
 *
 * The two-stage pipeline pools early (symptom-driven) and refined (AI-query
 * driven) results instead of replacing one with the other. These tests pin the
 * pooling/ordering contract so a weak AI query can never discard a stronger
 * early candidate.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { poolProductRecommendations } from "../lib/ai/product-pool.ts";
import type { ProductRecommendation } from "@/types/ai";
import { makeProduct } from "./fixtures.ts";

function makeRec(id: string, score: number): ProductRecommendation {
  return {
    product: makeProduct({ id, name: id }),
    categoryName: null,
    reason: `reason for ${id}`,
    compatibility: "compatible",
    warnings: [],
    score,
    provisional: false,
  };
}

test("empty refined results do not erase early results", () => {
  const early = [makeRec("eye-drops-1", 5.5)];
  const result = poolProductRecommendations(early, [], 6);
  assert.deepEqual(
    result.map((item) => item.product.id),
    ["eye-drops-1"],
  );
});

test("duplicate candidates merge to the higher-scoring entry", () => {
  const result = poolProductRecommendations(
    [makeRec("eye-drops-1", 4.0)],
    [makeRec("eye-drops-1", 6.0)],
    6,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].score, 6.0);
});

test("a weak AI (domain) hit never overrides a stronger early (direct) hit", () => {
  const earlyDirect = makeRec("eye-drops-otc", 5.8);
  const refinedDomain = makeRec("eye-supplement-1", 2.1);
  const result = poolProductRecommendations([earlyDirect], [refinedDomain], 6);
  assert.equal(result[0].product.id, "eye-drops-otc");
  assert.ok(result.some((item) => item.product.id === "eye-supplement-1"));
});

test("relevant early candidates survive when refined returns unrelated ones", () => {
  const early = makeRec("eye-drops-otc", 5.8);
  const refined = makeRec("unrelated-pill", 3.0);
  const result = poolProductRecommendations([early], [refined], 6);
  assert.deepEqual(
    result.map((item) => item.product.id),
    ["eye-drops-otc", "unrelated-pill"],
  );
});

test("ranking is deterministic for equal scores (stable id tiebreak)", () => {
  const a = makeRec("aaa", 4.0);
  const b = makeRec("bbb", 4.0);
  const result = poolProductRecommendations([b, a], [], 6);
  assert.deepEqual(
    result.map((item) => item.product.id),
    ["aaa", "bbb"],
  );
});
