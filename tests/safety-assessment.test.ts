/**
 * Deterministic safety-assessment tests.
 *
 * These pin the level/permission semantics with fixtures only — no AI model,
 * no network. A regression here is a safety regression.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  assessSafety,
  coerceSafetyAssessment,
  productGateDecision,
} from "../lib/safety/red-flags.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import type { CaseFacts } from "@/types/ai";
import { makeFacts } from "./fixtures.ts";

function assess(message: string, facts = extractHeuristicFacts(message)) {
  return assessSafety(facts, message);
}

/* ── Eye protocol ────────────────────────────────────────────── */

test('"Ali\'s eyes are red." is caution — allowed (provisional), with eye follow-ups', () => {
  const assessment = assess("Ali's eyes are red.");

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
  assert.ok(assessment.triggers.includes("eye-redness-unresolved"));
  assert.equal(assessment.requiresProfessionalEvaluation, false);
  // The eye protocol must ask about pain, vision, light sensitivity,
  // injury/chemical exposure and contact lenses.
  const questions = assessment.followUpQuestions.join(" ").toLowerCase();
  assert.ok(questions.includes("pain"));
  assert.ok(questions.includes("vision"));
  assert.ok(questions.includes("light"));
  assert.ok(questions.includes("chemical"));
  assert.ok(questions.includes("contact lens"));
  assert.equal(assessment.rulesetVersion.length > 0, true);
});

test('"My eye hurts and my vision is blurry." is urgent — blocked, professional evaluation', () => {
  const assessment = assess("My eye hurts and my vision is blurry.");

  assert.equal(assessment.level, "urgent");
  assert.equal(assessment.recommendationPermission, "blocked");
  assert.ok(assessment.detectedRedFlags.includes("eye-vision-threat"));
  assert.equal(assessment.requiresProfessionalEvaluation, true);
  // The actionable next step must be present and listed before any question.
  assert.ok(assessment.nextSteps.length > 0);
  assert.equal(assessment.recommendedNextStep, assessment.nextSteps[0]);
  // Targeted questions may follow, but they must never replace the guidance.
  assert.ok(assessment.followUpQuestions.length > 0);
});

test('"A chemical splashed into my eye." is emergency — rinse and emergency care first', () => {
  const assessment = assess("A chemical splashed into my eye.");

  assert.equal(assessment.level, "emergency");
  assert.equal(assessment.recommendationPermission, "blocked");
  assert.ok(assessment.detectedRedFlags.includes("eye-chemical-exposure"));
  const nextSteps = assessment.nextSteps.join(" ").toLowerCase();
  assert.ok(nextSteps.includes("rinse"));
  assert.ok(nextSteps.includes("emergency"));
  assert.equal(assessment.followUpQuestions.length, 0);
  assert.equal(assessment.requiresProfessionalEvaluation, true);
});

test('"My eyes are red and I wear contact lenses." follows the lens protocol — urgent, blocked', () => {
  const assessment = assess("My eyes are red and I wear contact lenses.");

  assert.equal(assessment.level, "urgent");
  assert.equal(assessment.recommendationPermission, "blocked");
  assert.ok(assessment.detectedRedFlags.includes("eye-contact-lens-redness"));
  const nextSteps = assessment.nextSteps.join(" ").toLowerCase();
  assert.ok(nextSteps.includes("remove"));
  assert.ok(nextSteps.includes("lens"));
});

test("eye injury is urgent and blocked", () => {
  const assessment = assess("He hit in the eye with a ball.");

  assert.equal(assessment.level, "urgent");
  assert.equal(assessment.recommendationPermission, "blocked");
  assert.ok(assessment.detectedRedFlags.includes("eye-trauma"));
});

/* ── Routine / shopping paths ────────────────────────────────── */

test("mild dry skin + moisturizer is routine — allowed", () => {
  const assessment = assess("I have mild dry skin and want a moisturizer.");

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("dark spots shopping request is routine — allowed", () => {
  const assessment = assess("I want a product for dark spots.");

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("allergy ingredient question is routine (retrieval verifies the data)", () => {
  const facts = makeFacts({
    allergies: ["aspirin"],
    goal: "Does this product contain aspirin?",
  });
  const assessment = assessSafety(
    facts,
    "I am allergic to aspirin. Does this product contain it?",
  );

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

/* ── Insufficient information / fallbacks ────────────────────── */

test('"Recommend a supplement for my symptom." has no concrete symptom — insufficient_information', () => {
  const assessment = assess("Recommend a supplement for my symptom.");

  assert.equal(assessment.level, "insufficient_information");
  // The gate no longer withholds for a vague request; retrieval simply finds
  // nothing to show. The assessment itself stays honest.
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("empty message yields insufficient_information, never routine", () => {
  const assessment = assessSafety(makeFacts(), "");

  assert.equal(assessment.level, "insufficient_information");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("an engine failure falls back to a conservative restricted stance", () => {
  // A malformed facts object makes the engine throw internally and fall back.
  const broken = { ...makeFacts(), symptoms: null } as unknown as CaseFacts;
  const assessment = assessSafety(broken, "x");

  assert.equal(assessment.level, "insufficient_information");
  assert.equal(assessment.recommendationPermission, "restricted");
  // Advisory only — the pipeline still shows any retrieved products.
  assert.equal(productGateDecision(assessment).allowed, false);
});

test("cardiac chest pain is emergency and blocked", () => {
  const assessment = assess("My customer has severe chest pain.");

  assert.equal(assessment.level, "emergency");
  assert.equal(assessment.recommendationPermission, "blocked");
  assert.ok(assessment.detectedRedFlags.includes("cardiac"));
});

test("deterministic-only path still catches red eyes (heuristics)", () => {
  // Simulates the pipeline when the model is unavailable: only heuristic
  // facts exist, yet the eye-redness caution must still fire from the raw
  // message haystack.
  const facts = extractHeuristicFacts("Ali's eyes are red.");
  const assessment = assessSafety(facts, "Ali's eyes are red.");

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
});

/* ── Coercion of untrusted/persisted payloads ────────────────── */

test("coerceSafetyAssessment narrows legacy rows conservatively", () => {
  const legacyHigh = coerceSafetyAssessment({
    status: "HIGH_RISK",
    explanation: "x",
    questions: [],
    nextSteps: [],
  });
  assert.equal(legacyHigh?.level, "urgent");
  assert.equal(legacyHigh?.recommendationPermission, "blocked");

  const legacyLow = coerceSafetyAssessment({
    status: "LOWER_RISK",
    explanation: "x",
    questions: [],
    nextSteps: [],
  });
  assert.equal(legacyLow?.level, "routine");
  assert.equal(legacyLow?.recommendationPermission, "allowed");

  // A HIGH_RISK row must never widen itself to "allowed".
  const tampered = coerceSafetyAssessment({
    status: "HIGH_RISK",
    recommendationPermission: "allowed",
  });
  assert.equal(tampered?.recommendationPermission, "blocked");

  // Legacy UNRESOLVED rows map to the new caution semantics: allowed.
  const legacyUnresolved = coerceSafetyAssessment({
    status: "UNRESOLVED",
    explanation: "x",
    questions: [],
    nextSteps: [],
  });
  assert.equal(legacyUnresolved?.recommendationPermission, "allowed");

  assert.equal(coerceSafetyAssessment(null), null);
  assert.equal(coerceSafetyAssessment("garbage"), null);
});

test("product gate decision matches the permission", () => {
  const blocked = assess("A chemical splashed into my eye.");
  const gate = productGateDecision(blocked);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reasonCode, "safety_blocked");

  const routine = assess("I want a moisturizer.");
  const open = productGateDecision(routine);
  assert.equal(open.allowed, true);
  assert.equal(open.reasonCode, "safety_allowed");
});

/* ── Allergy + shopping, interactions, eye-protocol resolution ── */

test("allergy plus a concrete symptom request proceeds to filtered products", () => {
  const facts = makeFacts({
    allergies: ["zinc"],
    symptoms: ["acne"],
    productQueries: ["zinc free acne cream"],
  });
  const assessment = assessSafety(
    facts,
    "my client is allergic to zinc and has acne",
  );

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("a bare symptom keyword is actionable immediately, without a questions prompt", () => {
  const assessment = assess("I have acne.");

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
  assert.equal(assessment.followUpQuestions.length, 0);
});

test("simple keyword symptoms stay routine so results are not delayed", () => {
  for (const message of ["cough", "headache", "nausea"]) {
    const assessment = assess(message);
    assert.equal(assessment.level, "routine", message);
    assert.equal(assessment.recommendationPermission, "allowed", message);
    assert.equal(assessment.followUpQuestions.length, 0, message);
  }
});

test("eye pain is a targeted caution with the eye protocol questions", () => {
  const assessment = assess("eye pain");

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
  assert.ok(assessment.triggers.includes("eye-pain-unresolved"));
  assert.ok(assessment.followUpQuestions.length > 0);
});

test("rule-driven cautions still ask their focused questions", () => {
  // The eye protocol is a genuine, targeted safety check: it must keep its
  // questions even though generic missing-detail questions are gone.
  const assessment = assess("Ali's eyes are red.");

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
  assert.ok(assessment.followUpQuestions.length > 0);
});

test("medicine combination question is flagged as caution without red-flag keywords", () => {
  const assessment = assess(
    "client uses x pills, is y supplement good to use?",
  );

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
  assert.ok(assessment.triggers.includes("medication-combination-question"));
  assert.ok(
    assessment.followUpQuestions.some((question) =>
      question.toLowerCase().includes("interaction"),
    ),
  );
});

test("answered eye-protocol questions resolve the red-eye caution", () => {
  const facts = makeFacts({
    symptoms: ["red eye"],
    productQueries: ["eye drops"],
  });
  const message =
    "No eye pain, vision is fine, no light sensitivity, no injury, and she does not wear contact lenses.";
  const assessment = assessSafety(facts, message);

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("a partial eye-protocol answer does not resolve the caution", () => {
  const facts = makeFacts({ symptoms: ["red eye"] });
  const assessment = assessSafety(facts, "No eye pain.");

  assert.equal(assessment.level, "caution");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("negated severe pain does not escalate", () => {
  const facts = makeFacts({ symptoms: ["headache"] });
  const assessment = assessSafety(
    facts,
    "No severe pain, just a mild headache.",
  );

  assert.notEqual(assessment.level, "urgent");
  assert.equal(assessment.level, "routine");
});
