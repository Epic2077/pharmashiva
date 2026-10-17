/**
 * Product-card emission for the pipeline.
 *
 * Safety level, recommendation permission and product visibility are three
 * different things and must not be conflated:
 *
 *  - the safety assessment says how urgent the concern is;
 *  - the relevance/safety gate in retrieval says which candidates are
 *    justifiable;
 *  - the display policy says how the frontend should present what survived.
 *
 * A red flag alone never suppresses every card. Emergency/urgent cases keep
 * independently-relevant cards, but mark them `show_with_safety_context` so the
 * UI can state they are not a treatment for the unresolved symptom. When no
 * candidate passes the gate the honest result is `no_relevant_products`.
 */

import type {
  ProductDisplayPolicy,
  ProductRecommendation,
  SafetyAssessment,
  ShoppingIntent,
} from "@/types/ai";

export interface ProductEmission {
  products: ProductRecommendation[];
  provisional: boolean;
  databaseAvailable: boolean;
  queries: string[];
  suppressed: boolean;
  gateReason: string | null;
  intent: ShoppingIntent;
  displayPolicy: ProductDisplayPolicy;
}

export interface EmissionInput {
  safety: SafetyAssessment;
  products: ProductRecommendation[];
  databaseAvailable: boolean;
  queries: string[];
  intent: ShoppingIntent;
}

/** Stable reason codes for diagnostics. */
export type ProductDisplayReason =
  | "no_candidates"
  | "routine_candidates"
  | "safety_context_active";

/**
 * Choose the display policy. Keeping this a pure function makes the
 * backend↔frontend contract testable without rendering React.
 */
export function productDisplayPolicy(input: {
  safety: SafetyAssessment;
  products: ProductRecommendation[];
}): ProductDisplayPolicy {
  if (input.products.length === 0) return "no_relevant_products";
  if (input.safety.level === "emergency" || input.safety.level === "urgent") {
    return "show_with_safety_context";
  }
  if (
    input.safety.level === "caution" ||
    input.safety.level === "insufficient_information" ||
    input.safety.recommendationPermission === "restricted"
  ) {
    return "show_with_safety_context";
  }
  return "show_relevant_products";
}

export function productDisplayReason(
  policy: ProductDisplayPolicy,
): ProductDisplayReason {
  if (policy === "no_relevant_products") return "no_candidates";
  if (policy === "show_with_safety_context") return "safety_context_active";
  return "routine_candidates";
}

/**
 * Plan the `products` event payload. Cards are never withheld merely because a
 * red flag fired; the display policy communicates the correct framing instead.
 */
export function planProductEmission(input: EmissionInput): ProductEmission {
  const displayPolicy = productDisplayPolicy(input);
  return {
    products: input.products,
    provisional: displayPolicy === "show_with_safety_context",
    databaseAvailable: input.databaseAvailable,
    queries: input.queries.slice(0, 3),
    suppressed: false,
    gateReason: null,
    intent: input.intent,
    displayPolicy,
  };
}
