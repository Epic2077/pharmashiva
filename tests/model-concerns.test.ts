/**
 * Model-proposed safety concerns: validation and escalation-only semantics.
 *
 * The interpretation model can raise concerns the keyword rules miss (e.g. a
 * drug interaction question), but its output is untrusted: malformed concerns
 * are dropped and a concern can never *lower* the deterministic assessment or
 * widen the recommendation gate.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  applyModelConcerns,
  applyModelFollowUpQuestions,
  assessSafety,
  isAllergyOnlyConcern,
} from "../lib/safety/red-flags.ts";
import { parseSafetyConcerns } from "../lib/ai/interpret.ts";
import { extractHeuristicFacts } from "../lib/ai/case-heuristics.ts";
import { makeFacts } from "./fixtures.ts";

const routine = assessSafety(
  makeFacts({ goal: "moisturizer" }),
  "I want a moisturizer.",
);

test("a caution concern raises routine to caution/allowed", () => {
  const escalated = applyModelConcerns(routine, [
    {
      severity: "caution",
      reason: "the customer takes warfarin and the product may interact",
    },
  ]);

  assert.equal(escalated.level, "caution");
  assert.equal(escalated.recommendationPermission, "allowed");
  assert.equal(escalated.modelConcerns.length, 1);
  assert.ok(
    escalated.explanation.startsWith("The assistant flagged a concern"),
  );
  assert.ok(escalated.explanation.includes("warfarin"));
  assert.ok(escalated.followUpQuestions.length > 0);
});

test("an urgent concern raises routine to urgent/blocked and leads the alert", () => {
  const escalated = applyModelConcerns(routine, [
    { severity: "urgent", reason: "symptom pattern needs prompt assessment" },
  ]);

  assert.equal(escalated.level, "urgent");
  assert.equal(escalated.recommendationPermission, "blocked");
  assert.equal(escalated.requiresProfessionalEvaluation, true);
  assert.ok(
    escalated.explanation.startsWith(
      "The assistant identified a potential red flag",
    ),
  );
  assert.ok(escalated.explanation.includes("symptom pattern"));
  assert.equal(escalated.followUpQuestions.length, 0);
  assert.ok(escalated.nextSteps.length > 0);
});

test("urgent concern on a caution base leads with the flag and clears follow-up questions", () => {
  // The eye protocol is a rule-driven caution that keeps focused questions.
  const cautionBase = assessSafety(
    extractHeuristicFacts("Ali's eyes are red."),
    "Ali's eyes are red.",
  );
  assert.ok(cautionBase.followUpQuestions.length > 0);

  const escalated = applyModelConcerns(cautionBase, [
    {
      severity: "urgent",
      reason:
        "yellow eyes in pregnancy may indicate jaundice or liver/biliary disease; needs prompt medical assessment before any product suggestion",
    },
  ]);

  assert.equal(escalated.level, "urgent");
  assert.equal(escalated.recommendationPermission, "blocked");
  assert.ok(
    escalated.explanation.startsWith(
      "The assistant identified a potential red flag",
    ),
  );
  assert.ok(escalated.explanation.includes("yellow eyes"));
  assert.ok(
    !escalated.explanation.includes("No urgent red flag was identified"),
    "stale 'no red flag' wording must never precede a real flag",
  );
  assert.equal(escalated.followUpQuestions.length, 0);
  assert.equal(escalated.questions.length, 0);
  assert.ok(escalated.nextSteps.length > 0);
  assert.equal(escalated.requiresProfessionalEvaluation, true);
});

test("emergency dominates urgent", () => {
  const escalated = applyModelConcerns(routine, [
    { severity: "urgent", reason: "x" },
    { severity: "emergency", reason: "possible sight-threatening signal" },
  ]);

  assert.equal(escalated.level, "emergency");
  assert.equal(escalated.recommendationPermission, "blocked");
});

test("concerns can never downgrade an existing assessment", () => {
  const urgent = assessSafety(
    extractHeuristicFacts("My eye hurts and my vision is blurry."),
    "My eye hurts and my vision is blurry.",
  );
  const withCautionOnly = applyModelConcerns(urgent, [
    { severity: "caution", reason: "minor note" },
  ]);

  assert.equal(withCautionOnly.level, "urgent");
  assert.equal(withCautionOnly.recommendationPermission, "blocked");
});

test("malformed concerns are dropped without changing the assessment", () => {
  const unchanged = applyModelConcerns(routine, [
    { severity: "critical", reason: "not a valid severity" } as never,
    { severity: "caution", reason: "" },
    { severity: 42, reason: "x" } as never,
    "garbage" as never,
    null as never,
  ]);

  assert.equal(unchanged.level, "routine");
  assert.equal(unchanged.recommendationPermission, "allowed");
  assert.equal(unchanged.modelConcerns.length, 0);
});

test("parseSafetyConcerns validates the untrusted model field", () => {
  assert.deepEqual(
    parseSafetyConcerns({
      safetyConcerns: [
        { severity: "caution", reason: " possible interaction " },
        { severity: "urgent", reason: "ok" },
      ],
    }),
    [
      { severity: "caution", reason: "possible interaction" },
      { severity: "urgent", reason: "ok" },
    ],
  );

  assert.deepEqual(parseSafetyConcerns({ safetyConcerns: "nope" }), []);
  assert.deepEqual(parseSafetyConcerns(null), []);
  assert.deepEqual(
    parseSafetyConcerns({
      safetyConcerns: [{ severity: "emergency" }, { reason: "x" }],
    }),
    [],
  );
});

test("a model concern on an already-caution case is recorded, gate unchanged", () => {
  const caution = assessSafety(
    extractHeuristicFacts("Ali's eyes are red."),
    "Ali's eyes are red.",
  );
  const merged = applyModelConcerns(caution, [
    { severity: "caution", reason: "also confirm pregnancy suitability" },
  ]);

  assert.equal(merged.level, "caution");
  assert.equal(merged.recommendationPermission, "allowed");
  assert.equal(merged.modelConcerns.length, 1);
});

test("model questions are added to caution assessments after the protocol questions", () => {
  const caution = assessSafety(
    extractHeuristicFacts("Ali's eyes are red."),
    "Ali's eyes are red.",
  );
  const withQuestions = applyModelFollowUpQuestions(caution, [
    "Has she used any new eye makeup recently?",
    "Any itching or discharge?",
  ]);

  assert.equal(withQuestions.level, "caution");
  // Protocol questions first, then the model's questions.
  assert.equal(withQuestions.followUpQuestions.length, 7);
  assert.deepEqual(withQuestions.followUpQuestions.slice(5), [
    "Has she used any new eye makeup recently?",
    "Any itching or discharge?",
  ]);
  assert.deepEqual(withQuestions.questions, withQuestions.followUpQuestions);
});

test("model questions never delay urgent or emergency guidance", () => {
  const urgent = assessSafety(
    extractHeuristicFacts("My eye hurts and my vision is blurry."),
    "My eye hurts and my vision is blurry.",
  );
  const withQuestions = applyModelFollowUpQuestions(urgent, [
    "How long has it been like this?",
  ]);

  assert.equal(withQuestions.level, "urgent");
  // Model questions are never appended to urgent guidance. The deterministic
  // rule questions may remain, but the next step is always listed first.
  assert.ok(
    !withQuestions.followUpQuestions.includes(
      "How long has it been like this?",
    ),
  );
  assert.ok(withQuestions.nextSteps.length > 0);
  assert.equal(withQuestions.recommendedNextStep, withQuestions.nextSteps[0]);
});

test("invalid model questions are dropped", () => {
  const caution = assessSafety(
    extractHeuristicFacts("Ali's eyes are red."),
    "Ali's eyes are red.",
  );
  const withQuestions = applyModelFollowUpQuestions(caution, [
    42 as never,
    "" as never,
    "   ",
    "Valid question",
  ]);

  assert.equal(withQuestions.followUpQuestions.length, 6);
  assert.equal(
    withQuestions.followUpQuestions[withQuestions.followUpQuestions.length - 1],
    "Valid question",
  );
});

test("an allergy-only caution concern does not gate the filtered suggestions", () => {
  const facts = makeFacts({
    allergies: ["zinc"],
    symptoms: ["dry skin"],
    productQueries: ["moisturizer"],
  });
  const base = assessSafety(
    facts,
    "my patients skin is dry what are some good skin cares for her? she is also allergic to zinc",
  );
  const concern = {
    severity: "caution" as const,
    reason:
      "customer reports zinc allergy; any product chosen must be checked to be zinc-free",
  };
  assert.equal(isAllergyOnlyConcern(concern, facts), true);

  const kept = [concern].filter((item) => !isAllergyOnlyConcern(item, facts));
  const assessment = applyModelConcerns(base, kept);

  assert.equal(assessment.level, "routine");
  assert.equal(assessment.recommendationPermission, "allowed");
});

test("urgent allergy-related concerns are never dropped", () => {
  const facts = makeFacts({ allergies: ["zinc"] });
  assert.equal(
    isAllergyOnlyConcern(
      { severity: "urgent", reason: "possible severe allergic reaction" },
      facts,
    ),
    false,
  );
});

test("an allergy caution is kept when no allergy is recorded in the facts", () => {
  const facts = makeFacts({ allergies: [] });
  assert.equal(
    isAllergyOnlyConcern(
      { severity: "caution", reason: "check for latex allergy" },
      facts,
    ),
    false,
  );
});
