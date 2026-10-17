/**
 * Product-card emission for the pipeline.
 *
 * Product suggestions are always shown: the safety assessment is advisory and
 * never removes cards. Red flags still surface as their own alert above the
 * products, and the hard allergy exclusion in retrieval is unaffected. This
 * module just packages the retrieved products into the `products` stream
 * event, so tests can pin the final API shape without running the AI.
 */

import type {
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
}

export interface EmissionInput {
  safety: SafetyAssessment;
  products: ProductRecommendation[];
  databaseAvailable: boolean;
  queries: string[];
  intent: ShoppingIntent;
}

/**
 * Plan the `products` event payload. Products always pass through; a case that
 * is not `routine` marks them `provisional` so the UI can nudge the pharmacist
 * to read the safety alert, but the cards themselves are never withheld.
 */
export function planProductEmission(input: EmissionInput): ProductEmission {
  return {
    products: input.products,
    provisional: input.safety.level !== "routine",
    databaseAvailable: input.databaseAvailable,
    queries: input.queries.slice(0, 3),
    suppressed: false,
    gateReason: null,
    intent: input.intent,
  };
}
