/**
 * Chat-memory semantics: accumulated `productQueries` are history, not intent.
 *
 * A follow-up turn must not replay stale AI queries as though they were the
 * current turn's search intent — that was the root cause of a stale
 * "eye supplement" query displacing fresh symptom-driven results.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyMemory,
  mergeMemory,
  memoryToFacts,
} from "../lib/chat/memory.ts";
import { makeFacts } from "./fixtures.ts";

test("memoryToFacts does not replay accumulated product queries as intent", () => {
  const first = mergeMemory(
    emptyMemory(),
    makeFacts({
      symptoms: ["red eye"],
      productQueries: ["قطره چشم", "تقویت چشم"],
    }),
    "red eye",
  );
  // A follow-up with no new symptom words keeps the symptom history, but the
  // historical product queries must NOT surface as current-turn intent.
  const followUp = mergeMemory(first, makeFacts({ symptoms: [] }), "it got worse");
  const facts = memoryToFacts(followUp);

  assert.ok(facts.searchTerms.includes("red eye"), "symptom history is kept");
  assert.deepEqual(facts.productQueries, [], "stale queries are not replayed");
});

test("mergeMemory accumulates product queries as append-only history", () => {
  const first = mergeMemory(
    emptyMemory(),
    makeFacts({ productQueries: ["قطره چشم"] }),
    "red eye",
  );
  const second = mergeMemory(
    first,
    makeFacts({ productQueries: ["اشک مصنوعی"] }),
    "dry eyes",
  );
  assert.deepEqual(second.productQueries, ["قطره چشم", "اشک مصنوعی"]);
});

test("symptoms remain accumulated for safety context across turns", () => {
  const first = mergeMemory(
    emptyMemory(),
    makeFacts({ symptoms: ["red eye"] }),
    "red eye",
  );
  const followUp = mergeMemory(first, makeFacts({ symptoms: [] }), "it got worse");
  assert.deepEqual(memoryToFacts(followUp).symptoms, ["red eye"]);
});
