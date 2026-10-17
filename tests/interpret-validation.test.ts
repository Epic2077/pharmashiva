/**
 * Interpretation validation tests: the model's JSON output is untrusted.
 * Malformed payloads must fall back to the deterministic facts — they can
 * never widen the safety assessment or invent retrieval input.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { parseCaseFacts, parseFollowUpQuestions } from "../lib/ai/interpret.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import { assessSafety } from "../lib/safety/red-flags.ts";
import { makeFacts } from "./fixtures.ts";

test("null model output falls back to the deterministic facts", () => {
  const fallback = extractHeuristicFacts("Ali's eyes are red.");
  const parsed = parseCaseFacts(null, fallback);
  assert.equal(parsed, fallback);
});

test("non-object output falls back safely", () => {
  const fallback = makeFacts({ symptoms: ["red eye"] });
  const parsed = parseCaseFacts("garbage", fallback);
  assert.equal(parsed.summary, fallback.summary);
  assert.deepEqual(parsed.symptoms, fallback.symptoms);
});

test("wrongly-typed fields are dropped, never trusted", () => {
  const fallback = makeFacts({ symptoms: ["red eye"], age: 30 });
  const parsed = parseCaseFacts(
    {
      symptoms: "red eye", // not an array — dropped
      goal: 42, // not a string — dropped
      age: "abc", // not a number — dropped
      allergies: [1, 2, 3], // non-strings — dropped
      productQueries: "eye drops", // not an array — dropped
      pregnancy: "yes", // not a boolean — dropped
    },
    fallback,
  );

  assert.deepEqual(parsed.symptoms, ["red eye"]);
  assert.equal(parsed.goal, fallback.goal);
  assert.equal(parsed.age, 30);
  assert.deepEqual(parsed.allergies, []);
  assert.deepEqual(parsed.productQueries, fallback.productQueries);
  assert.equal(parsed.pregnancy, null);
});

test("out-of-range age is rejected", () => {
  const fallback = makeFacts();
  const parsed = parseCaseFacts({ age: 500 }, fallback);
  assert.equal(parsed.age, null);
});

test("malformed model output still yields a conservative assessment", () => {
  // What the pipeline does on failure: heuristic facts → deterministic safety.
  const facts = extractHeuristicFacts("Ali's eyes are red.");
  const assessment = assessSafety(facts, "Ali's eyes are red.");
  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("parseFollowUpQuestions validates the untrusted model field", () => {
  assert.deepEqual(
    parseFollowUpQuestions({
      followUpQuestions: [" Does it itch? ", "Any discharge?", 42, null],
    }),
    ["Does it itch?", "Any discharge?"],
  );
  assert.deepEqual(parseFollowUpQuestions({ followUpQuestions: "nope" }), []);
  assert.deepEqual(parseFollowUpQuestions(null), []);
  assert.deepEqual(parseFollowUpQuestions({ followUpQuestions: [""] }), []);
});
