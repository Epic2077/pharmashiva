/**
 * Deterministic response text used when the model is unavailable or returns
 * nothing. It is grounded strictly in the safety result and the real retrieved
 * candidates — it never invents products.
 */

import type {
  CaseFacts,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";

export function buildFallbackResponse(params: {
  facts: CaseFacts;
  safety: SafetyAssessment;
  products: ProductRecommendation[];
}): string {
  const { safety, products } = params;
  const lines: string[] = [];

  if (safety.status === "HIGH_RISK") {
    lines.push(`⚠️ **Urgent — this case needs prompt attention.**`);
    lines.push(safety.explanation);
    if (safety.nextSteps.length) {
      lines.push("");
      lines.push("**Next steps**");
      for (const step of safety.nextSteps) lines.push(`- ${step}`);
    }
  } else if (safety.status === "UNRESOLVED") {
    lines.push(
      "I need a little more information before finalising a suggestion.",
    );
    if (safety.questions.length) {
      lines.push("");
      for (const question of safety.questions) lines.push(`- ${question}`);
    }
  } else {
    lines.push("Here is what I can share based on the details provided.");
  }

  if (products.length > 0) {
    lines.push("");
    lines.push(
      `I found ${products.length} matching ${
        products.length === 1 ? "product" : "products"
      } in the current catalog, shown below.`,
    );
    if (safety.level !== "routine") {
      lines.push(
        "These suggestions are provisional — review the safety check above before dispensing.",
      );
    }
  } else {
    lines.push("");
    lines.push(
      "No suitable matching products were found in the current catalog.",
    );
  }

  return lines.join("\n");
}

/** Appended when an AI call failed, so we never imply an assessment ran. */
export const AI_UNAVAILABLE_NOTE =
  "_The AI explanation is temporarily unavailable. The safety assessment and catalog results above come from deterministic checks._";
