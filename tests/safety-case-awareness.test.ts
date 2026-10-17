/**
 * Case-aware safety tests: negation, hypothesis, history, contradictions,
 * Persian normalisation, protocol state, product display policy and the
 * final response contract.
 *
 * All fixtures are deterministic — no AI provider or network is involved.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assessSafety } from "../lib/safety/red-flags.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import { sanitizeSymptoms } from "../lib/ai/interpret.ts";
import {
  planProductEmission,
  productDisplayPolicy,
} from "../lib/ai/product-gating.ts";
import { buildFallbackResponse } from "../lib/ai/fallback-response.ts";
import {
  ageBrightAndSpotFader,
  lubricantEyeDrops,
  makeFacts,
} from "./fixtures.ts";

function assess(message: string, facts = extractHeuristicFacts(message)) {
  return assessSafety(facts, message);
}

/* ── Negation / hypothesis / history ─────────────────────────── */

test('"no chest pain" never fires the cardiac emergency rule', () => {
  const assessment = assess("No chest pain, just a mild cough.");

  assert.notEqual(assessment.level, "emergency");
  assert.notEqual(assessment.level, "urgent");
  assert.ok(!assessment.detectedRedFlags.includes("cardiac"));
});

test("a negated finding elsewhere does not cancel a different positive finding", () => {
  const assessment = assess("No cough, but I have chest pain.");

  assert.equal(assessment.level, "emergency");
  assert.ok(assessment.detectedRedFlags.includes("cardiac"));
});

test("hypothetical examples are not present findings", () => {
  const assessment = assess(
    "If a customer had chest pain, what would you suggest?",
  );

  assert.notEqual(assessment.level, "emergency");
  assert.notEqual(assessment.level, "urgent");
});

test("a resolved historical symptom is not an active red flag", () => {
  const assessment = assess("She had chest pain last week but it resolved.");

  assert.notEqual(assessment.level, "emergency");
  assert.notEqual(assessment.level, "urgent");
});

test("a later denial overrides an earlier positive mention in the case", () => {
  const facts = makeFacts({
    symptoms: ["chest pain"],
    statedFacts: ["Customer had chest pain yesterday."],
  });
  const assessment = assessSafety(facts, "No chest pain now.");

  assert.notEqual(assessment.level, "emergency");
  assert.ok(!assessment.detectedRedFlags.includes("cardiac"));
});

test("a normal follow-up clears a stale earlier-turn predicate finding", () => {
  const facts = makeFacts({
    symptoms: ["blurred vision", "eye pain"],
    statedFacts: ["Vision was blurry and the eye hurt."],
  });
  const assessment = assessSafety(facts, "Vision is fine now.");

  assert.notEqual(assessment.level, "urgent");
  assert.notEqual(assessment.level, "emergency");
});

test("a negative follow-up cannot hide a positive symptom in the same message", () => {
  const assessment = assess("No nausea, but the chest pain is still there.");

  assert.equal(assessment.level, "emergency");
});

/* ── Eye pain / hurting phrasing ────────────────────────────── */

test('"eyes hurting" is a targeted eye concern, not insufficient information', () => {
  for (const message of [
    "eyes hurting",
    "my eyes are hurting",
    "my eyes hurt",
    "eye pain",
    "درد چشم دارم",
  ]) {
    const assessment = assess(message);
    assert.equal(assessment.level, "caution", message);
    assert.ok(
      assessment.triggers.some(
        (trigger) =>
          trigger === "eye-pain-unresolved" ||
          trigger === "eye-redness-unresolved",
      ),
      message,
    );
    assert.ok(assessment.followUpQuestions.length > 0, message);
    const questions = assessment.followUpQuestions.join(" ").toLowerCase();
    assert.ok(questions.includes("vision"), message);
    assert.ok(questions.includes("light"), message);
    assert.ok(questions.includes("injury"), message);
    assert.ok(questions.includes("contact lenses"), message);
  }
});

test("the eye-pain protocol resolves once all questions are answered", () => {
  const facts = makeFacts({
    symptoms: ["eye pain"],
    statedFacts: ["My eyes are hurting."],
  });
  const assessment = assessSafety(
    facts,
    "No pain now, vision is fine, no light sensitivity, no injury, no contact lenses.",
  );

  assert.equal(assessment.level, "routine");
});

/* ── Wider body-system coverage ─────────────────────────────── */

test("a spreading skin infection is urgent", () => {
  const assessment = assess(
    "There is spreading redness and red streaks from the wound.",
  );

  assert.equal(assessment.level, "urgent");
  assert.ok(assessment.detectedRedFlags.includes("skin-infection"));
  assert.ok(assessment.followUpQuestions.length > 0);
});

test("a suspected adverse drug reaction is urgent", () => {
  const assessment = assess(
    "She had a bad reaction to the medicine and a rash after taking it.",
  );

  assert.equal(assessment.level, "urgent");
  assert.ok(assessment.detectedRedFlags.includes("adverse-drug-reaction"));
});

test("a denied adverse reaction does not escalate", () => {
  const assessment = assess(
    "No adverse reaction to the medicine, just asking about the dose.",
  );

  assert.notEqual(assessment.level, "urgent");
  assert.notEqual(assessment.level, "emergency");
});

/* ── Persian / spelling normalisation ────────────────────────── */

test("Persian red-eye phrasing is detected", () => {
  const assessment = assess("چشمام قرمزه");

  assert.equal(assessment.level, "caution");
  assert.ok(assessment.triggers.includes("eye-redness-unresolved"));
  assert.ok(assessment.followUpQuestions.length > 0);
});

test("Arabic keyboard variants of Persian chest pain are normalised", () => {
  const assessment = assess("درد قفسه سينه دارم");

  assert.equal(assessment.level, "emergency");
  assert.ok(assessment.detectedRedFlags.includes("cardiac"));
});

/* ── Protocol state across turns ─────────────────────────────── */

test("the eye protocol resolves only when every question is answered", () => {
  const facts = makeFacts({
    symptoms: ["red eye"],
    statedFacts: ["No eye pain."],
  });
  const assessment = assessSafety(
    facts,
    "Vision is fine, no light sensitivity, no injury, and she does not wear contact lenses.",
  );

  assert.equal(assessment.level, "routine");
});

test("a partially answered protocol keeps the concern and asks only the rest", () => {
  const facts = makeFacts({
    symptoms: ["red eye"],
    statedFacts: ["No eye pain, vision is fine."],
  });
  const assessment = assessSafety(facts, "No light sensitivity.");

  assert.equal(assessment.level, "caution");
  const questions = assessment.followUpQuestions.join(" ").toLowerCase();
  // Already answered: do not ask again.
  assert.ok(!questions.includes("painful"));
  assert.ok(!questions.includes("vision changed"));
  // Still unanswered: injury/chemical and contact lenses.
  assert.ok(questions.includes("injury"));
  assert.ok(questions.includes("contact lenses"));
});

test("a positive protocol answer keeps the concern active", () => {
  const facts = makeFacts({ symptoms: ["red eye"] });
  const assessment = assessSafety(
    facts,
    "No eye pain, vision is fine, no light sensitivity, no injury, no contact lenses — but the eye hurts now.",
  );

  // The latest answer wins and re-opens the eye concern; it is not resolved by
  // the earlier negations.
  assert.equal(assessment.level, "caution");
  assert.ok(assessment.triggers.includes("eye-redness-unresolved"));
});

/* ── Emergency guidance ordering ─────────────────────────────── */

test("urgency guidance is listed before any clarifying question", () => {
  const assessment = assess("My eye hurts and my vision is blurry.");

  assert.equal(assessment.level, "urgent");
  assert.ok(assessment.nextSteps.length > 0);
  assert.equal(assessment.recommendedNextStep, assessment.nextSteps[0]);
  // Questions may follow, but the next step is authoritative.
  assert.equal(assessment.requiresProfessionalEvaluation, true);
});

/* ── Model output sanitisation ───────────────────────────────── */

test("model symptoms that the message denies are dropped", () => {
  const sanitized = sanitizeSymptoms(
    ["chest pain", "cough"],
    "No chest pain, but a cough.",
  );
  assert.deepEqual(sanitized, ["cough"]);
});

/* ── Separate safety / display policy ────────────────────────── */

function recommendation(product = lubricantEyeDrops()) {
  return {
    product,
    categoryName: null,
    reason: "matches eye drops",
    compatibility: "compatible" as const,
    warnings: [],
    score: 1,
    provisional: false,
  };
}

test("a red flag alone does not suppress independently relevant cards", () => {
  const safety = assess("My eye hurts and my vision is blurry.");
  const emission = planProductEmission({
    safety,
    products: [recommendation()],
    databaseAvailable: true,
    queries: ["eye drops"],
    intent: "medical_symptom",
  });

  assert.equal(emission.suppressed, false);
  assert.equal(emission.products.length, 1);
  assert.equal(emission.displayPolicy, "show_with_safety_context");
});

test("no candidates produces an honest no_relevant_products policy", () => {
  const safety = assess("My eye hurts and my vision is blurry.");
  const policy = productDisplayPolicy({ safety, products: [] });

  assert.equal(policy, "no_relevant_products");
});

test("a routine case with relevant candidates uses show_relevant_products", () => {
  const safety = assess("I want eye drops for dry eyes.");
  const policy = productDisplayPolicy({
    safety,
    products: [recommendation()],
  });

  assert.equal(policy, "show_relevant_products");
});

test("the fallback answer never presents products as treatment for an urgent symptom", () => {
  const safety = assess("My eye hurts and my vision is blurry.");
  const text = buildFallbackResponse({
    facts: makeFacts({ symptoms: ["eye pain", "vision change"] }),
    safety,
    products: [recommendation()],
  });

  assert.ok(
    text.toLowerCase().includes("not a treatment"),
    "urgent product cards must carry an explicit non-treatment warning",
  );
  assert.ok(text.toLowerCase().includes("next steps"));
});

test("an irrelevant candidate is never fabricated into the answer", () => {
  const safety = assess("Ali's eyes are red.");
  const emission = planProductEmission({
    safety,
    products: [], // the relevance gate already rejected the serum
    databaseAvailable: true,
    queries: ["eye drops"],
    intent: "medical_symptom",
  });

  assert.equal(emission.displayPolicy, "no_relevant_products");
  assert.equal(emission.products.length, 0);
  assert.equal(emission.suppressed, false);
  // The unrelated beauty product is not present anywhere in the payload.
  assert.ok(
    !emission.products.some(
      (item) => item.product.id === ageBrightAndSpotFader().id,
    ),
  );
});
