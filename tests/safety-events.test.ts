/**
 * Safety-event sequencing tests: which assessments actually reach the client.
 *
 * Regressed once before: a caution assessment was deduplicated against an
 * *unsent* instant assessment, so the safety alert never appeared. These
 * tests pin the event plan.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assessSafety } from "../lib/safety/red-flags.ts";
import {
  planSafetyEvent,
  safetyEquals,
  shouldSendInstantSafety,
} from "../lib/ai/safety-events.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import { makeFacts } from "./fixtures.ts";

const caution = assessSafety(
  extractHeuristicFacts("Ali's eyes are red."),
  "Ali's eyes are red.",
);
const routine = assessSafety(
  makeFacts({ goal: "moisturizer" }),
  "I want a moisturizer.",
);
const urgent = assessSafety(
  extractHeuristicFacts("My eye hurts and my vision is blurry."),
  "My eye hurts and my vision is blurry.",
);

test("a caution assessment must be sent when the instant one was not", () => {
  const planned = planSafetyEvent({
    instantSafety: caution,
    instantEventSent: false,
    safety: caution,
    shouldShow: true,
  });
  assert.ok(planned, "the assessment must reach the client");
  assert.equal(planned.level, "caution");
});

test("an identical assessment is not sent twice", () => {
  const planned = planSafetyEvent({
    instantSafety: caution,
    instantEventSent: true,
    safety: caution,
    shouldShow: true,
  });
  assert.equal(planned, null);
});

test("an escalated authoritative assessment replaces the instant one", () => {
  const planned = planSafetyEvent({
    instantSafety: caution,
    instantEventSent: true,
    safety: urgent,
    shouldShow: true,
  });
  assert.equal(planned?.level, "urgent");
});

test("shouldShow=false never emits an event", () => {
  const planned = planSafetyEvent({
    instantSafety: routine,
    instantEventSent: false,
    safety: routine,
    shouldShow: false,
  });
  assert.equal(planned, null);
});

test("safetyEquals compares the structured fields", () => {
  assert.equal(safetyEquals(caution, caution), true);
  assert.equal(safetyEquals(caution, routine), false);
});

test("instant caution is held back while the model can still escalate it", () => {
  // A caution assessment must not flash as a warning right before the model
  // escalates the case to urgent.
  assert.equal(shouldSendInstantSafety(caution, true), false);
});

test("instant HIGH_RISK surfaces immediately even with the model available", () => {
  assert.equal(shouldSendInstantSafety(urgent, true), true);
});

test("without a model the instant assessment always surfaces immediately", () => {
  assert.equal(shouldSendInstantSafety(caution, false), true);
  assert.equal(shouldSendInstantSafety(routine, false), true);
});

test("a held-back instant caution still produces the authoritative event", () => {
  const planned = planSafetyEvent({
    instantSafety: caution,
    instantEventSent: false, // not sent because the model could escalate
    safety: urgent,
    shouldShow: true,
  });
  assert.equal(planned?.level, "urgent");
});
