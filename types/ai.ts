/**
 * Shared types for the DeepSeek-powered consultation pipeline.
 *
 * These types cross the server↔client boundary (they are serialized as NDJSON
 * stream events), so they must stay free of server-only imports. The product
 * shape is re-used from `types/database` so the existing `ProductCard` can
 * render recommendations without an adapter.
 */

import type { ProductDetails } from "./database";

/* ── Safety ─────────────────────────────────────────────────── */

export type SafetyStatus = "HIGH_RISK" | "UNRESOLVED" | "LOWER_RISK";
export type SafetySeverity = "critical" | "warning" | "info";

/**
 * Structured severity of a case, from the deterministic ruleset.
 *  - emergency: potentially life- or vision-threatening — act immediately.
 *  - urgent: needs prompt professional assessment.
 *  - caution: more information or pharmacist assessment is needed before any
 *    product can be considered.
 *  - routine: no red flag identified from the available information.
 *  - insufficient_information: a safe next step cannot be determined yet.
 */
export type SafetyLevel =
  | "emergency"
  | "urgent"
  | "caution"
  | "routine"
  | "insufficient_information";

/**
 * Whether product cards may be returned for the current case. This is a hard
 * backend gate — the language model can never widen it.
 *  - blocked: no routine product recommendations (emergency/urgent only).
 *  - allowed: product cards may be shown — routine cases normally, caution
 *    cases as provisional suggestions, and short/vague requests surface
 *    whatever the catalog can offer.
 *  - restricted: recommendations withheld because the safety assessment could
 *    not be completed (engine-failure fallback only).
 */
export type RecommendationPermission = "blocked" | "restricted" | "allowed";

/**
 * The authoritative, deterministic safety assessment. The language model may
 * *explain* this, but it can never override it.
 */
export interface SafetyAssessment {
  status: SafetyStatus;
  severity: SafetySeverity;
  title: string;
  explanation: string;
  /**
   * Legacy aliases of the structured fields below, kept so previously
   * persisted messages and the existing safety-alert UI keep rendering.
   */
  questions: string[];
  nextSteps: string[];
  /** Ids of the deterministic rules that fired (for debugging/audit). */
  triggers: string[];
  /** True when produced purely by deterministic rules (model unavailable). */
  deterministicOnly?: boolean;

  /** Structured safety level (see `SafetyLevel`). */
  level: SafetyLevel;
  /** Hard backend gate controlling product cards. */
  recommendationPermission: RecommendationPermission;
  /** Ids of the emergency/urgent rules that fired. */
  detectedRedFlags: string[];
  /** Why the assessment reached this level. */
  reasons: string[];
  /** Focused questions that would resolve remaining uncertainty. */
  followUpQuestions: string[];
  /** Single recommended next step, or null when none is indicated. */
  recommendedNextStep: string | null;
  /** True when a professional (doctor/eye specialist) should evaluate. */
  requiresProfessionalEvaluation: boolean;
  /** Version of the deterministic ruleset that produced this assessment. */
  rulesetVersion: string;
  /** Validated concerns raised by the model (escalation-only). */
  modelConcerns: ModelSafetyConcern[];
}

/** Machine-readable product-card gate decision derived from the assessment. */
export interface ProductGateDecision {
  allowed: boolean;
  permission: RecommendationPermission;
  /** Stable reason code for logs/tests, e.g. "safety_emergency". */
  reasonCode: string;
  /** Human-readable reason shown when cards are withheld. */
  reason: string;
}

/**
 * A concern raised by the interpretation model, validated at runtime. Model
 * concerns can only *raise* the safety level — they can never downgrade the
 * deterministic assessment or widen the recommendation gate.
 */
export interface ModelSafetyConcern {
  severity: "emergency" | "urgent" | "caution";
  reason: string;
}

/* ── Case interpretation ────────────────────────────────────── */

export interface CaseFacts {
  summary: string;
  symptoms: string[];
  goal: string | null;
  category: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  age: number | null;
  pregnancy: boolean | null;
  duration: string | null;
  /** Customer name if the message states one, otherwise null. */
  customerName: string | null;
  /** Important information the user has not provided. */
  missingInformation: string[];
  /** Facts the user explicitly stated. */
  statedFacts: string[];
  /** Facts the model inferred (never treated as certain). */
  inferredFacts: string[];
  /** Terms to hand to the database search (symptoms/goal). */
  searchTerms: string[];
  /** AI-proposed product queries (categories, product classes, active ingredients). */
  productQueries: string[];
}

/**
 * Accumulated, per-chat memory of the case. Built by `mergeMemory`
 * (lib/chat/memory.ts), which is append-only so a red flag raised on an earlier
 * turn is never silently dropped. This is what lets a follow-up like "it gets
 * worse day by day" stay attached to the original problem.
 */
export interface CaseMemory {
  customerName: string | null;
  /** Main problem(s), in the customer's own words. */
  problems: string[];
  symptoms: string[];
  /** Latest stated duration or progression. */
  duration: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  age: number | null;
  pregnancy: boolean | null;
  /** Append-only key statements; the red-flag safety context. */
  notes: string[];
  /** Retrieval queries accumulated across the case. */
  productQueries: string[];
  /** ISO timestamp of the last memory update. */
  updatedAt?: string;
}

export interface CaseInterpretation {
  facts: CaseFacts;
  /** Reasoning lines for the Thinking tab. May be empty. */
  reasoning: string[];
  /** True when the model was unavailable and heuristics were used instead. */
  fallback: boolean;
  /** Validated safety concerns proposed by the model (escalation-only). */
  safetyConcerns: ModelSafetyConcern[];
  /**
   * Questions the model wants the pharmacist to ask. Only shown on caution
   * assessments; urgent/emergency guidance is never delayed by questions.
   */
  followUpQuestions: string[];
}

/* ── Product recommendations ────────────────────────────────── */

export type ProductCompatibility = "compatible" | "unknown" | "conflict";

/**
 * Shopping intent derived from the case facts. Keeps symptom-driven requests
 * separate from pure beauty or supplement shopping so a product valid for one
 * intent is not offered for another.
 */
export type ShoppingIntent =
  | "medical_symptom"
  | "beauty"
  | "supplement"
  | "general";

/** Machine-readable reason a candidate product was kept out of the reply. */
export type RelevanceDecisionCode =
  | "intended_use_mismatch"
  | "scope_mismatch"
  | "insufficient_product_data"
  | "allergy_conflict"
  | "no_queryable_intent";

/** Per-candidate relevance decision produced by the deterministic gate. */
export interface RelevanceVerdict {
  productId: string;
  pass: boolean;
  code: RelevanceDecisionCode | null;
  reason: string;
  matchedTokens: string[];
}

export interface ProductRecommendation {
  product: ProductDetails;
  /** Localized leaf-category name, or null when unknown/untranslated. */
  categoryName: string | null;
  /** Deterministic, traceable reason the product was included. */
  reason: string;
  compatibility: ProductCompatibility;
  /** Limitations, e.g. incomplete ingredient data. */
  warnings: string[];
  /** Deterministic ranking score (debug/explainability). */
  score: number;
  /** True while the safety assessment is not LOWER_RISK. */
  provisional: boolean;
}

/* ── Stream protocol (NDJSON events) ────────────────────────── */

export type ChatStage =
  | "received"
  | "interpreting"
  | "assessing"
  | "retrieving"
  | "composing"
  | "done";

export type ChatEvent =
  | { type: "status"; stage: ChatStage }
  | { type: "thinking"; delta: string }
  | { type: "memory"; memory: CaseMemory }
  | { type: "safety"; safety: SafetyAssessment }
  | {
      type: "products";
      products: ProductRecommendation[];
      provisional: boolean;
      /** False when the catalog could not be reached. */
      databaseAvailable: boolean;
      /** Queries that were executed against the database. */
      queries?: string[];
      /** True when product cards were withheld by a safety/relevance gate. */
      suppressed?: boolean;
      /** Machine-readable reason code when cards are withheld. */
      gateReason?: string;
      /** Shopping intent used for retrieval (observability only). */
      intent?: ShoppingIntent;
    }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done"; timings?: Record<string, number> };

/** Latency checkpoints collected through the pipeline (ms since receipt). */
export interface PipelineTimings {
  received: number;
  interpreted: number;
  safety: number;
  database: number;
  firstToken: number;
  done: number;
}

/**
 * Server-side diagnostics for one pipeline run. Contains only rule ids,
 * product ids and machine-readable codes — never user content. Logged via the
 * pipeline's `log` callback; not exposed to the client.
 */
export interface PipelineDiagnostics {
  safety: {
    rulesetVersion: string;
    level: SafetyLevel;
    permission: RecommendationPermission;
    triggers: string[];
    deterministicOnly: boolean;
  };
  retrieval: {
    databaseAvailable: boolean;
    queries: string[];
    scope: ShoppingIntent;
    candidates: number;
    kept: number;
    excluded: Array<{ productId: string; code: RelevanceDecisionCode }>;
    missingIngredientData: boolean;
  };
  timings: PipelineTimings;
}

export interface PipelineReport {
  timings: PipelineTimings;
  diagnostics: PipelineDiagnostics;
}
