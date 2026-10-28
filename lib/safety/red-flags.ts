/**
 * Deterministic red-flag safety engine.
 *
 * This is deliberately rule-based and independent of any language model. The
 * model may *explain* the assessment, but it can never override or downgrade
 * it. The ruleset lives in `./rules.ts` and is version-controlled; the
 * assessment produced here is fully structured (`level`,
 * `recommendationPermission`, …) so the UI can present it honestly instead of
 * relying on prompt wording. Products are always shown; this engine never
 * withholds them.
 *
 * The function is synchronous and performs no IO, so it can never time out or
 * fail silently: an unexpected internal error falls back to a conservative
 * "insufficient_information" assessment.
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
  EYE_PROTOCOL,
  EYE_PROTOCOL_CAUTION_IDS,
  SAFETY_RULESET_VERSION,
  evaluateEyeProtocol,
  type RedFlagRule,
} from "./rules.ts";
import {
  extractClinicalFindings,
  hasUnnegatedTerm,
  isResolvedMention,
  lastMentionIsUnnegated,
  mentionsResolution,
  normaliseHealthText,
  termIsDenied,
  type ClinicalFinding,
} from "./text.ts";

/** The stored case history (everything except the current message). */
function priorCaseText(facts: CaseFacts): string {
  // `symptoms` comes first so the chronological notes (which include the
  // customer's later denials) are the *last* mention for contradiction
  // resolution.
  return [
    facts.summary,
    ...facts.symptoms,
    ...facts.statedFacts,
    facts.duration ?? "",
  ]
    .filter(Boolean)
    .join(" \n ");
}

/**
 * Case-aware term matching with latest-answer precedence.
 *
 * - A term positively stated in the current message always counts.
 * - An explicit denial in the current message suppresses the term even if an
 *   earlier turn mentioned it ("chest pain yesterday, no chest pain now").
 * - A term from earlier turns remains active unless the current message
 *   resolves or denies it; a red flag is not dropped merely because the latest
 *   message stopped mentioning it.
 * - Historical, resolved mentions ("it settled") are not active findings.
 */
function caseTermPresent(term: string, latest: string, prior: string): boolean {
  if (hasUnnegatedTerm(latest, term)) {
    return !isResolvedMention(latest, term);
  }
  if (termIsDenied(latest, term)) return false;
  // The last mention in the stored case decides contradictions: a denial on a
  // previous turn must suppress an even earlier positive mention.
  if (!lastMentionIsUnnegated(prior, term)) return false;
  if (isResolvedMention(latest, term) || isResolvedMention(prior, term)) {
    return false;
  }
  return true;
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
  findings?: ClinicalFinding[];
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
 * Conservative assessment used when the engine itself misbehaves. It reports a
 * restricted stance so the UI reflects that no safety rule actually ran.
 */
function safeFallbackAssessment(): SafetyAssessment {
  return buildAssessment({
    level: "insufficient_information",
    redFlags: [],
    caution: [],
    reasons: [
      "The safety assessment could not be completed; review the case carefully.",
    ],
    followUpQuestions: [],
    nextSteps: [
      "Review the case carefully and seek professional advice before making any suggestion.",
    ],
    explanation:
      "The safety assessment could not be completed. Please review the case carefully before making any suggestion.",
    title: "Safety assessment unavailable",
    // Marks the stance as restricted so callers can tell no safety rule ran.
    permission: "restricted",
  });
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
    findings: input.findings ?? [],
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
    const latest = normaliseHealthText(rawMessage);
    const prior = normaliseHealthText(priorCaseText(facts));

    const ruleMatches = (rule: RedFlagRule): boolean => {
      if (rule.terms.some((term) => caseTermPresent(term, latest, prior))) {
        return true;
      }
      if (!rule.test) return false;
      if (rule.test(latest) === true) return true;
      // Earlier-turn predicate findings persist unless the latest message
      // explicitly reports a normal/resolved state.
      if (mentionsResolution(latest)) return false;
      return rule.test(prior) === true;
    };

    const redFlags = EMERGENCY_AND_URGENT_RULES.filter(ruleMatches);

    // Eye protocol state is tracked per question across the whole case, not
    // inferred from a count of negations in one arbitrary sentence.
    const eyeProtocol = evaluateEyeProtocol(latest, prior);

    // Caution rules only apply when nothing more serious fired.
    const caution =
      redFlags.length === 0 ? CAUTION_RULES.filter(ruleMatches) : [];

    // A fully answered, non-positive eye protocol resolves both the red-eye
    // and eye-pain concerns. A partially answered protocol keeps them active
    // and only asks the remaining questions.
    const effectiveCaution = caution.filter(
      (rule) =>
        !(EYE_PROTOCOL_CAUTION_IDS.has(rule.id) && eyeProtocol.resolved),
    );

    const findings = extractClinicalFindings(latest, prior);
    for (const question of EYE_PROTOCOL) {
      if (eyeProtocol.statuses[question.id] === "unknown") {
        findings.push({
          id: `eye_protocol_${question.id}`,
          label: question.question,
          status: "unknown",
          evidence: "",
        });
      }
    }

    // Red flags: highest level wins (emergency > urgent).
    const hasEmergency = redFlags.some((rule) => rule.level === "emergency");
    if (redFlags.length > 0) {
      const level: SafetyLevel = hasEmergency ? "emergency" : "urgent";
      const steps = Array.from(new Set(redFlags.map((rule) => rule.nextStep)));
      const labels = redFlags.map((rule) => rule.label);
      // Urgent (not emergency) guidance may be followed by focused questions;
      // the next step is always listed first and is never conditional on them.
      const followUps =
        level === "urgent"
          ? Array.from(
              new Set(redFlags.flatMap((rule) => rule.followUpQuestions ?? [])),
            ).slice(0, 4)
          : [];
      return buildAssessment({
        level,
        redFlags,
        caution: [],
        reasons: [
          `Possible ${labels.join("; ")}.`,
          ...redFlags.map((rule) => rule.explanation),
        ],
        followUpQuestions: followUps,
        nextSteps: steps,
        explanation: `This case may involve a red flag: ${labels.join("; ")}. ${redFlags
          .map((rule) => rule.explanation)
          .join(" ")}`,
        title: hasEmergency
          ? "Urgent safety concern — act now"
          : "Urgent safety concern",
        findings,
      });
    }

    if (effectiveCaution.length > 0) {
      const ids = effectiveCaution.map((rule) => rule.id);
      const followUps = Array.from(
        new Set(
          effectiveCaution.flatMap((rule) =>
            EYE_PROTOCOL_CAUTION_IDS.has(rule.id)
              ? eyeProtocol.unansweredQuestions
              : (CAUTION_FOLLOW_UPS[rule.id] ?? []),
          ),
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
          "No urgent warning sign was identified, but this symptom needs more information before any product can be suggested.",
        title: "More information needed",
        findings,
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
          "Describe the customer's concern or what kind of product you are looking for.",
        ],
        explanation:
          "There is not enough information to determine what is being asked or what would be safe to suggest.",
        title: "More information needed",
        findings,
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
      findings,
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
    const entry = concern as ModelSafetyConcern;
    valid.push({
      ...entry,
      severity,
      reason: reason.trim().slice(0, 200),
      followUpQuestions: Array.isArray(entry.followUpQuestions)
        ? entry.followUpQuestions
            .filter(
              (question): question is string => typeof question === "string",
            )
            .map((question) => question.trim().slice(0, 200))
            .filter(Boolean)
            .slice(0, 3)
        : undefined,
    });
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

  const concernFindings: ClinicalFinding[] = valid.map((concern, index) => ({
    id: `model_concern_${index + 1}`,
    label: "AI-identified safety concern",
    status: "present",
    evidence: concern.reason.slice(0, 120),
  }));

  const concernQuestions = valid.flatMap(
    (concern) => concern.followUpQuestions ?? [],
  );

  if (level === assessment.level) {
    const mergedQuestions =
      level === "caution"
        ? Array.from(
            new Set([...assessment.followUpQuestions, ...concernQuestions]),
          ).slice(0, 8)
        : assessment.followUpQuestions;
    return {
      ...assessment,
      modelConcerns: [...assessment.modelConcerns, ...valid],
      reasons: [...assessment.reasons, ...reasonLines],
      explanation: `The assistant flagged: ${concernText}. ${assessment.explanation}`,
      findings: [...assessment.findings, ...concernFindings],
      questions: mergedQuestions,
      followUpQuestions: mergedQuestions,
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
      : level === "caution"
        ? Array.from(
            new Set([
              ...(assessment.followUpQuestions.length > 0
                ? assessment.followUpQuestions
                : [
                    "Please verify this concern with a reliable reference before any product is suggested.",
                  ]),
              ...concernQuestions,
            ]),
          ).slice(0, 8)
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
    findings: [...assessment.findings, ...concernFindings],
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

  // Structured findings are validated on read as well.
  const findings: ClinicalFinding[] = [];
  if (Array.isArray(record.findings)) {
    for (const item of record.findings as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const status = entry.status;
      if (
        typeof entry.id !== "string" ||
        typeof entry.label !== "string" ||
        (status !== "present" &&
          status !== "denied" &&
          status !== "historical" &&
          status !== "unknown")
      ) {
        continue;
      }
      findings.push({
        id: entry.id.slice(0, 80),
        label: entry.label.slice(0, 160),
        status,
        evidence:
          typeof entry.evidence === "string"
            ? entry.evidence.slice(0, 200)
            : "",
      });
      if (findings.length >= 24) break;
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
    findings,
  };
}

/* ── Recommendation advisory (no longer gates display) ───────── */

const GATE_REASONS: Record<
  RecommendationPermission,
  { code: string; reason: string }
> = {
  blocked: {
    code: "safety_blocked",
    reason:
      "The safety assessment recommends urgent professional attention before dispensing.",
  },
  restricted: {
    code: "safety_restricted",
    reason:
      "The safety assessment could not be completed; review the case carefully.",
  },
  allowed: {
    code: "safety_allowed",
    reason: "The safety assessment raised no blocking concern.",
  },
};

/**
 * Describe the safety assessment's recommendation stance. This is advisory
 * only: product cards are always shown and are never withheld by this decision.
 * It is kept for diagnostics, logging and any caller that wants to reflect the
 * safety stance in its own wording.
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
