/**
 * Pure product-card gating for the pipeline.
 *
 * Turns the deterministic safety assessment into the exact `products` stream
 * event. This is the single place the backend decides whether product cards
 * may reach the client, so tests can pin the final API behaviour without
 * running the AI or the catalog.
 */

import type {
  ProductRecommendation,
  SafetyAssessment,
  ShoppingIntent,
} from "@/types/ai";
import { productGateDecision } from "../safety/red-flags.ts";

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
 * Plan the `products` event payload. Only an emergency/urgent (blocked) or
 * insufficient-information (restricted) assessment suppresses the cards;
 * caution-level cases show their suggestions flagged `provisional` so the
 * pharmacist can work fast while the alert questions remain open.
 */
export function planProductEmission(input: EmissionInput): ProductEmission {
  const gate = productGateDecision(input.safety);

  if (!gate.allowed) {
    return {
      products: [],
      provisional: true,
      // The catalog was not consulted; do not misreport it as unavailable.
      databaseAvailable: true,
      queries: [],
      suppressed: true,
      gateReason: gate.reasonCode,
      intent: input.intent,
    };
  }

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
