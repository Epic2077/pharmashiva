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
 * The authoritative, deterministic safety assessment. The language model may
 * *explain* this, but it can never override it.
 */
export interface SafetyAssessment {
  status: SafetyStatus;
  severity: SafetySeverity;
  title: string;
  explanation: string;
  /** Focused questions that would resolve remaining uncertainty. */
  questions: string[];
  /** Urgent next steps / referral indicated by the matched rules. */
  nextSteps: string[];
  /** Ids of the deterministic rules that fired (for debugging/audit). */
  triggers: string[];
  /** True when produced purely by deterministic rules (model unavailable). */
  deterministicOnly?: boolean;
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
  /** Important information the user has not provided. */
  missingInformation: string[];
  /** Facts the user explicitly stated. */
  statedFacts: string[];
  /** Facts the model inferred (never treated as certain). */
  inferredFacts: string[];
  /** Terms to hand to the database search. */
  searchTerms: string[];
}

export interface CaseInterpretation {
  facts: CaseFacts;
  /** Reasoning lines for the Thinking tab. May be empty. */
  reasoning: string[];
  /** True when the model was unavailable and heuristics were used instead. */
  fallback: boolean;
}

/* ── Product recommendations ────────────────────────────────── */

export type ProductCompatibility = "compatible" | "unknown" | "conflict";

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
  | { type: "safety"; safety: SafetyAssessment }
  | {
      type: "products";
      products: ProductRecommendation[];
      provisional: boolean;
      /** False when the catalog could not be reached. */
      databaseAvailable: boolean;
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
