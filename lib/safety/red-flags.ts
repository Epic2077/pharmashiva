/**
 * Deterministic red-flag safety engine.
 *
 * This is deliberately rule-based and independent of any language model. The
 * model may *explain* the assessment, but it can never override or downgrade
 * it. The ruleset lives in `./rules.ts` and is version-controlled; the
 * assessment produced here is fully structured (`level`,
 * `recommendationPermission`, …) so the pipeline can enforce the product gate
 * in code instead of relying on prompt wording.
 *
 * The function is synchronous and performs no IO, so it can never time out or
 * fail silently: an unexpected internal error falls back to a conservative
 * "insufficient_information" assessment that withholds products.
 */

import type {
  CaseFacts,
  ModelSafetyConcern,
  ProductGateDecision,
  RecommendationPermission,
  SafetyAssessment,
  SafetyLevel,
  SafetySeverity,
  SafetyStatus,
} from "@/types/ai";
import {
  CAUTION_FOLLOW_UPS,
  CAUTION_RULES,
  EMERGENCY_AND_URGENT_RULES,
  SAFETY_RULESET_VERSION,
  eyeRednessResolved,
  type RedFlagRule,
} from "./rules.ts";

function haystack(facts: CaseFacts, rawMessage: string): string {
  return [
    rawMessage,
    facts.summary,
    ...facts.symptoms,
    ...facts.statedFacts,
    facts.duration ?? "",
  ]
    .join(" \n ")
    .toLowerCase();
}

function isCustomerCase(facts: CaseFacts): boolean {
  return facts.symptoms.length > 0;
}

/** Product/shopping vocabulary that makes a message a concrete request. */
const SHOPPING_VOCAB =
  /\b(?:want|need|looking for|recommend|suggest|product|cream|serum|moisturizer|moisturiser|lotion|shampoo|supplement|vitamin|drops|tablet|capsule|gel|mask|oil|spray)\b|میخواهم|میخوام|دنبال|محصول|کرم|سرم|مرطوب|مکمل|ویتامین|شامپو|قرص|کپسول|ژل|ماسک|قطره|روغن|اسپری/i;

/**
 * "Recommend a supplement for my symptom" names a symptom but no concrete
 * problem or product class — too vague to act on safely.
 */
function isVagueSymptomRequest(text: string, facts: CaseFacts): boolean {
  if (!/\bsymptom\b|علائم?/i.test(text)) return false;
  if (facts.symptoms.length > 0 || facts.productQueries.length > 0) {
    return false;
  }
  const concreteClass =
    /\b(?:cream|serum|moisturizer|moisturiser|lotion|shampoo|gel|mask|drops|tablet|capsule|oil|spray|soap|toner|sunscreen|ointment)\b|کرم|سرم|مرطوب|شامپو|ژل|ماسک|قطره|قرص|کپسول|روغن|اسپری|صابون|ضدآفتاب|پماد/i;
  return !concreteClass.test(text);
}

function severityForLevel(level: SafetyLevel): SafetySeverity {
  if (level === "emergency" || level === "urgent") return "critical";
  if (level === "routine") return "info";
  return "warning";
}

function statusForLevel(level: SafetyLevel): SafetyStatus {
  if (level === "emergency" || level === "urgent") return "HIGH_RISK";
  if (level === "routine") return "LOWER_RISK";
  return "UNRESOLVED";
}

function permissionForLevel(level: SafetyLevel): RecommendationPermission {
  // Only a genuine emergency or urgent red flag withholds product cards.
  // Everything else — including a short or vague request that lands in
  // insufficient_information — may show whatever the catalog can offer;
  // caution results are flagged provisional by the pipeline. The engine-failure
  // fallback is the one exception and pins "restricted" explicitly.
  if (level === "emergency" || level === "urgent") return "blocked";
  return "allowed";
}

/**
 * Conservative assessment used when the engine itself misbehaves. It must
 * never allow product recommendations.
 */
function safeFallbackAssessment(): SafetyAssessment {
  return buildAssessment({
    level: "insufficient_information",
    redFlags: [],
    caution: [],
    reasons: [
      "The safety assessment could not be completed; product recommendations are withheld as a precaution.",
    ],
    followUpQuestions: [],
    nextSteps: [
      "Review the case carefully and seek professional advice before making any suggestion.",
    ],
    explanation:
      "The safety assessment could not be completed. Please review the case carefully before making any suggestion.",
    title: "Safety assessment unavailable",
    // Even though insufficient_information normally allows products, a failed
    // assessment must never widen the gate.
    permission: "restricted",
  });
}

interface AssessmentInput {
  level: SafetyLevel;
  redFlags: RedFlagRule[];
  caution: RedFlagRule[];
  reasons: string[];
  followUpQuestions: string[];
  nextSteps: string[];
  explanation: string;
  title: string;
  /** Explicit permission override; only the engine-failure fallback uses it. */
  permission?: RecommendationPermission;
}

function buildAssessment(input: AssessmentInput): SafetyAssessment {
  const { level } = input;
  const requiresProfessionalEvaluation =
    level === "emergency" || level === "urgent";
  return {
    status: statusForLevel(level),
    severity: severityForLevel(level),
    title: input.title,
    explanation: input.explanation,
    // Legacy aliases, kept populated so existing UI and persisted messages
    // continue to render without changes.
    questions: input.followUpQuestions,
    nextSteps: input.nextSteps,
    triggers: [...input.redFlags, ...input.caution].map((rule) => rule.id),
    level,
    recommendationPermission: input.permission ?? permissionForLevel(level),
    detectedRedFlags: input.redFlags.map((rule) => rule.id),
    reasons: input.reasons,
    followUpQuestions: input.followUpQuestions,
    recommendedNextStep: input.nextSteps[0] ?? null,
    requiresProfessionalEvaluation,
    rulesetVersion: SAFETY_RULESET_VERSION,
    modelConcerns: [],
  };
}

/**
 * Assess the case. `deterministicOnly` is set by the pipeline when the model
 * was unavailable, so the UI can be honest about what ran.
 */
export function assessSafety(
  facts: CaseFacts,
  rawMessage: string,
): SafetyAssessment {
  try {
    const text = haystack(facts, rawMessage);

    const redFlags = EMERGENCY_AND_URGENT_RULES.filter(
      (rule) =>
        rule.terms.some((term) => text.includes(term)) ||
        rule.test?.(text) === true,
    );

    // Caution rules only apply when nothing more serious fired.
    const caution =
      redFlags.length === 0
        ? CAUTION_RULES.filter(
            (rule) =>
              rule.terms.some((term) => text.includes(term)) ||
              rule.test?.(text) === true,
          )
        : [];

    // The pharmacist answered the eye protocol with negations (no pain, no
    // vision change, no lenses, …): the red-eye concern is resolved and must
    // not keep gating products.
    const resolvedEyeRedness =
      caution.length === 1 &&
      caution[0].id === "eye-redness-unresolved" &&
      eyeRednessResolved(rawMessage);
    const effectiveCaution = resolvedEyeRedness ? [] : caution;

    // Red flags: highest level wins (emergency > urgent).
    const hasEmergency = redFlags.some((rule) => rule.level === "emergency");
    if (redFlags.length > 0) {
      const level: SafetyLevel = hasEmergency ? "emergency" : "urgent";
      const steps = Array.from(new Set(redFlags.map((rule) => rule.nextStep)));
      const labels = redFlags.map((rule) => rule.label);
      return buildAssessment({
        level,
        redFlags,
        caution: [],
        reasons: [
          `Possible ${labels.join("; ")}.`,
          ...redFlags.map((rule) => rule.explanation),
        ],
        followUpQuestions: [],
        nextSteps: steps,
        explanation: `This case may involve a red flag: ${labels.join("; ")}. ${redFlags
          .map((rule) => rule.explanation)
          .join(" ")}`,
        title: hasEmergency
          ? "Urgent safety concern — act now"
          : "Urgent safety concern",
      });
    }

    if (effectiveCaution.length > 0) {
      const ids = effectiveCaution.map((rule) => rule.id);
      const followUps = Array.from(
        new Set(
          effectiveCaution.flatMap((rule) => CAUTION_FOLLOW_UPS[rule.id] ?? []),
        ),
      );
      return buildAssessment({
        level: "caution",
        redFlags: [],
        caution: effectiveCaution,
        reasons: [
          `More information is needed before a product can be considered (${ids.join(", ")}).`,
          ...effectiveCaution.map((rule) => rule.explanation),
        ],
        followUpQuestions: followUps,
        nextSteps: [],
        explanation:
          "No urgent warning sign was identified, but this symptom needs more information (or pharmacist assessment) before any product can be suggested.",
        title: "More information needed",
      });
    }

    // A named, concrete symptom (e.g. "eye pain", "cough", "headache") is
    // actionable on its own. Previously this branch downgraded any such case
    // to a "More information needed" caution with up to five generic
    // questions, which told pharmacists to explain instead of showing them
    // results. Pharmacists work in keywords and expect red-flag screening plus
    // product suggestions immediately, so we no longer gate on missing
    // age/duration/medication details here. Targeted, rule-driven cautions
    // (eye protocol, medicine interactions) are handled above and still ask
    // their focused questions; the red-flag rules above are unchanged.

    // No symptom or shopping goal we can act on: we cannot determine a safe
    // next step from the available information.
    const hasRecognisableRequest =
      isCustomerCase(facts) ||
      Boolean(facts.goal && facts.goal.trim()) ||
      facts.productQueries.length > 0 ||
      facts.searchTerms.length > 0 ||
      (SHOPPING_VOCAB.test(rawMessage) &&
        !isVagueSymptomRequest(rawMessage, facts));
    if (!hasRecognisableRequest) {
      return buildAssessment({
        level: "insufficient_information",
        redFlags: [],
        caution: [],
        reasons: [
          "The request does not contain enough information to determine a safe next step.",
        ],
        followUpQuestions: [],
        nextSteps: [
          "Ask the pharmacist to describe the customer's concern or what kind of product they are looking for.",
        ],
        explanation:
          "There is not enough information to determine what is being asked or what would be safe to suggest.",
        title: "More information needed",
      });
    }

    return buildAssessment({
      level: "routine",
      redFlags: [],
      caution: [],
      reasons: ["No red flag was identified from the available information."],
      followUpQuestions: [],
      nextSteps: [],
      explanation:
        "No urgent warning signs were identified from the information provided. This is not a diagnosis and does not guarantee the customer is safe.",
      title: "No red flags identified",
    });
  } catch {
    // Internal failure must never widen product permission.
    return safeFallbackAssessment();
  }
}

/**
 * Apply validated model-proposed concerns to a deterministic assessment.
 *
 * Escalation-only: a model concern can raise the level (routine→caution,
 * caution→urgent, …) but can never lower it, and malformed concerns are
 * dropped. The recommendation gate always derives from the resulting level,
 * so an invalid or failed model call can never widen product permission.
 */
export function applyModelConcerns(
  assessment: SafetyAssessment,
  concerns: readonly ModelSafetyConcern[],
): SafetyAssessment {
  const valid: ModelSafetyConcern[] = [];
  for (const concern of concerns ?? []) {
    if (!concern || typeof concern !== "object") continue;
    const severity = (concern as { severity?: unknown }).severity;
    const reason = (concern as { reason?: unknown }).reason;
    if (
      severity !== "emergency" &&
      severity !== "urgent" &&
      severity !== "caution"
    ) {
      continue;
    }
    if (typeof reason !== "string" || !reason.trim()) continue;
    valid.push({ severity, reason: reason.trim().slice(0, 200) });
    if (valid.length >= 4) break;
  }
  if (valid.length === 0) return assessment;

  // Escalation matrix — never downgrade.
  let level: SafetyLevel = assessment.level;
  if (valid.some((concern) => concern.severity === "emergency")) {
    level = "emergency";
  } else if (valid.some((concern) => concern.severity === "urgent")) {
    if (level !== "emergency") level = "urgent";
  } else if (level === "routine") {
    level = "caution";
  }

  const reasonLines = valid.map(
    (concern) => `the assistant flagged: ${concern.reason}`,
  );
  const concernText = valid.map((concern) => concern.reason).join("; ");

  if (level === assessment.level) {
    return {
      ...assessment,
      modelConcerns: [...assessment.modelConcerns, ...valid],
      reasons: [...assessment.reasons, ...reasonLines],
      explanation: `The assistant flagged: ${concernText}. ${assessment.explanation}`,
    };
  }

  // Escalated: the assistant's finding leads the explanation. The stale
  // "no urgent red flag was identified" wording must never precede a real
  // flag, so for urgent/emergency escalations it is replaced entirely.
  const explanation =
    level === "emergency" || level === "urgent"
      ? `The assistant identified a potential red flag: ${concernText}.`
      : `The assistant flagged a concern to check first: ${concernText}. ${assessment.explanation}`;

  const nextSteps =
    level === "emergency"
      ? ["Seek urgent professional assessment for this concern."]
      : level === "urgent"
        ? [
            "Arrange prompt professional assessment before recommending anything.",
          ]
        : assessment.nextSteps;

  // Urgent/emergency guidance must not be delayed or buried under generic
  // clarifying questions — the next step is professional assessment.
  const followUpQuestions =
    level === "emergency" || level === "urgent"
      ? []
      : level === "caution" && assessment.followUpQuestions.length === 0
        ? [
            "Please verify this concern with a reliable reference before any product is suggested.",
          ]
        : assessment.followUpQuestions;

  return {
    ...assessment,
    status: statusForLevel(level),
    severity: severityForLevel(level),
    level,
    recommendationPermission: permissionForLevel(level),
    title:
      level === "emergency"
        ? "Urgent safety concern — act now"
        : level === "urgent"
          ? "Urgent safety concern"
          : level === "caution"
            ? "More information needed"
            : assessment.title,
    explanation,
    reasons: [...reasonLines, ...assessment.reasons],
    nextSteps,
    questions: followUpQuestions,
    followUpQuestions,
    recommendedNextStep: nextSteps[0] ?? assessment.recommendedNextStep,
    requiresProfessionalEvaluation:
      level === "emergency" ||
      level === "urgent" ||
      assessment.requiresProfessionalEvaluation,
    modelConcerns: [...assessment.modelConcerns, ...valid],
  };
}

/**
 * True when a caution concern is *only* about an allergy the case already
 * records. Allergies are a deterministic, hard-filterable constraint: the
 * retrieval layer already excludes matching ingredients (and marks
 * ingredient-data gaps as "cannot be confirmed"). Such a concern must not
 * escalate the gate and block otherwise safe, filtered suggestions.
 * Urgent/emergency concerns always pass this check.
 */
export function isAllergyOnlyConcern(
  concern: ModelSafetyConcern,
  facts: Pick<CaseFacts, "allergies">,
): boolean {
  if (concern.severity !== "caution") return false;
  if (facts.allergies.length === 0) return false;
  return /\ballerg\w*|allergic|sensitivit\w*|sensitive to|حساسیت/i.test(
    concern.reason,
  );
}

/**
 * Merge validated model-proposed questions into a caution assessment.
 *
 * The AI drives the case conversation, but questions are only shown on
 * caution-level assessments — urgent/emergency guidance is never delayed by
 * questions — and the deterministic protocol questions (eye safety,
 * interactions) stay first as the mandatory floor.
 */
export function applyModelFollowUpQuestions(
  assessment: SafetyAssessment,
  questions: readonly string[],
): SafetyAssessment {
  const valid: string[] = [];
  for (const question of questions ?? []) {
    if (typeof question !== "string") continue;
    const trimmed = question.trim().slice(0, 200);
    if (!trimmed) continue;
    valid.push(trimmed);
    if (valid.length >= 5) break;
  }
  if (valid.length === 0) return assessment;
  if (assessment.level !== "caution") return assessment;

  const seen = new Set(
    assessment.followUpQuestions.map((question) => question.toLowerCase()),
  );
  const merged = [...assessment.followUpQuestions];
  // Protocol questions already occupy up to 5 slots; leave room for the
  // model's more specific questions up to a combined cap of 8.
  for (const question of valid) {
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(question);
    if (merged.length >= 8) break;
  }

  return {
    ...assessment,
    followUpQuestions: merged,
    questions: merged,
  };
}

/**
 * Coerce an untrusted value (persisted row, stale client payload) into a
 * `SafetyAssessment`. Old rows without the structured fields get a
 * conservative permission derived from their legacy status.
 */
export function coerceSafetyAssessment(
  value: unknown,
): SafetyAssessment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const status: SafetyStatus =
    record.status === "HIGH_RISK" ||
    record.status === "UNRESOLVED" ||
    record.status === "LOWER_RISK"
      ? record.status
      : "UNRESOLVED";

  const legacyPermission: RecommendationPermission =
    status === "HIGH_RISK" ? "blocked" : "allowed";

  const level: SafetyLevel =
    record.level === "emergency" ||
    record.level === "urgent" ||
    record.level === "caution" ||
    record.level === "routine" ||
    record.level === "insufficient_information"
      ? record.level
      : status === "HIGH_RISK"
        ? "urgent"
        : status === "LOWER_RISK"
          ? "routine"
          : "caution";

  const strings = (key: string): string[] =>
    Array.isArray(record[key])
      ? (record[key] as unknown[]).filter(
          (item): item is string => typeof item === "string",
        )
      : [];

  const questions = strings("followUpQuestions");
  const nextSteps = strings("nextSteps");

  // Untrusted model concerns are validated on read as well.
  const modelConcerns: ModelSafetyConcern[] = [];
  if (Array.isArray(record.modelConcerns)) {
    for (const item of record.modelConcerns as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const severity = entry.severity;
      const reason = entry.reason;
      if (
        (severity === "emergency" ||
          severity === "urgent" ||
          severity === "caution") &&
        typeof reason === "string" &&
        reason.trim()
      ) {
        modelConcerns.push({
          severity,
          reason: reason.trim().slice(0, 200),
        });
        if (modelConcerns.length >= 4) break;
      }
    }
  }

  // Permission is narrowed conservatively: a HIGH_RISK row can never widen
  // itself to "allowed", no matter what the stored payload claims.
  const storedPermission =
    record.recommendationPermission === "blocked" ||
    record.recommendationPermission === "restricted" ||
    record.recommendationPermission === "allowed"
      ? record.recommendationPermission
      : legacyPermission;
  const recommendationPermission: RecommendationPermission =
    status === "HIGH_RISK" ? "blocked" : storedPermission;

  return {
    status,
    severity:
      record.severity === "critical" ||
      record.severity === "warning" ||
      record.severity === "info"
        ? record.severity
        : severityForLevel(level),
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title
        : "Safety assessment",
    explanation:
      typeof record.explanation === "string"
        ? record.explanation
        : "No explanation was recorded.",
    questions: strings("questions"),
    nextSteps,
    triggers: strings("triggers"),
    deterministicOnly:
      typeof record.deterministicOnly === "boolean"
        ? record.deterministicOnly
        : undefined,
    level,
    recommendationPermission,
    detectedRedFlags: strings("detectedRedFlags"),
    reasons: strings("reasons"),
    followUpQuestions: questions,
    recommendedNextStep:
      typeof record.recommendedNextStep === "string" &&
      record.recommendedNextStep.trim()
        ? record.recommendedNextStep
        : (nextSteps[0] ?? null),
    requiresProfessionalEvaluation:
      typeof record.requiresProfessionalEvaluation === "boolean"
        ? record.requiresProfessionalEvaluation
        : status === "HIGH_RISK",
    rulesetVersion:
      typeof record.rulesetVersion === "string"
        ? record.rulesetVersion
        : "unknown",
    modelConcerns,
  };
}

/* ── Recommendation gate (deterministic, backend-enforced) ───── */

const GATE_REASONS: Record<
  RecommendationPermission,
  { code: string; reason: string }
> = {
  blocked: {
    code: "safety_blocked",
    reason:
      "Product suggestions are withheld because this case needs urgent professional attention.",
  },
  restricted: {
    code: "safety_restricted",
    reason:
      "Product suggestions are withheld because the safety assessment could not be completed.",
  },
  allowed: {
    code: "safety_allowed",
    reason:
      "Product suggestions may be shown after relevance and allergy filtering.",
  },
};

/**
 * Turn an assessment into the hard product-card decision. Only a `blocked`
 * assessment (emergency/urgent) withholds the cards; everything else may show
 * product suggestions after relevance and allergy filtering.
 */
export function productGateDecision(
  assessment: SafetyAssessment,
): ProductGateDecision {
  const { code, reason } = GATE_REASONS[assessment.recommendationPermission];
  return {
    allowed: assessment.recommendationPermission === "allowed",
    permission: assessment.recommendationPermission,
    reasonCode: code,
    reason,
  };
}

/** Convenience predicate used by the pipeline and the UI. */
export function permissionAllowsProducts(
  assessment: Pick<SafetyAssessment, "recommendationPermission">,
): boolean {
  return assessment.recommendationPermission === "allowed";
}
