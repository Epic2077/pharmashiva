/**
 * Explicit, documented product recommendation scope.
 *
 * This is the single source of truth for "what may be recommended as a
 * product", replacing the previously implicit "cosmetics are excluded" boolean
 * in the retrieval layer.
 *
 * Policy (resolved decision):
 *  - For symptom (`medical_symptom`) and supplement shopping, supplements AND
 *    OTC catalogue medicines (e.g. eye drops, cough syrups) are eligible.
 *    Cosmetics are excluded: a cosmetic must never be offered as a treatment.
 *  - For beauty shopping, cosmetics are eligible; supplements and medicines are
 *    out of scope and are rejected by the relevance gate's scope separation
 *    (`scope_mismatch`), not here.
 *
 * Classification only ever relies on source-verified fields (the canonical URL
 * slug and the category names the source publishes) — see
 * `./product-classification.ts`. `medicine` here means "non-cosmetic,
 * non-supplement catalogue product" (analgesics, eye drops, syrups, devices).
 *
 * Known catalog metadata limitation: the source does not reliably distinguish
 * OTC from prescription-only medicines from the URL/category alone, so a
 * `medicine`-scope product must still be described honestly (never presented
 * as a substitute for professional assessment).
 */

import type { ProductDetails } from "@/types/database";
import type { ShoppingIntent } from "@/types/ai";
import { classifyProductKind } from "./product-classification";

/** The recommendation scope a product falls into, based on verified fields. */
export type ProductScope = "supplement" | "medicine" | "cosmetic" | "unknown";

export function productScope(product: ProductDetails): ProductScope {
  switch (classifyProductKind(product)) {
    case "supplement":
      return "supplement";
    case "cosmetic":
      return "cosmetic";
    case "medicine":
      return "medicine";
    default:
      return "unknown";
  }
}

export type ScopeDecision =
  | { eligible: true }
  | {
      eligible: false;
      code: "cosmetic_excluded" | "out_of_scope";
      reason: string;
    };

/**
 * Decide whether a product of the given scope may be recommended for an intent.
 * Called on every candidate that already passed the relevance gate, so it never
 * overrides a safety or relevance decision — it only enforces the scope policy.
 */
export function scopeDecision(
  scope: ProductScope,
  intent: ShoppingIntent,
): ScopeDecision {
  // Symptom and supplement shopping may recommend supplements and OTC
  // medicines, but never cosmetics.
  if (intent === "medical_symptom" || intent === "supplement") {
    if (scope === "cosmetic") {
      return {
        eligible: false,
        code: "cosmetic_excluded",
        reason: "Cosmetic products are not recommended for this request.",
      };
    }
    return { eligible: true };
  }

  // Beauty and general intents defer to the relevance gate's own scope
  // separation (candidateScope → scope_mismatch).
  return { eligible: true };
}
