/**
 * Prompt construction for the consultation pipeline.
 *
 * Prompts are kept short and contain only the context needed for the current
 * request, to protect latency and cost. Nothing here is logged.
 */

import type {
  CaseFacts,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";
import type { DeepSeekMessage } from "./deepseek.service";

/**
 * Interpretation prompt. Must mention "json" (DeepSeek JSON mode requirement)
 * and describe the exact shape we validate against.
 */
export const INTERPRET_SYSTEM_PROMPT = `You are a clinical case interpreter for a pharmacy assistant.

Read the pharmacist's message and return ONE json object describing the customer case.
Never invent facts. Use null for unknown values and [] for unknown lists.
Quote the customer's own words for facts they stated.

Return json with exactly these fields:
{
  "summary": string,
  "symptoms": string[],
  "goal": string | null,
  "category": string | null,
  "allergies": string[],
  "conditions": string[],
  "medications": string[],
  "age": number | null,
  "pregnancy": boolean | null,
  "duration": string | null,
  "missingInformation": string[],
  "statedFacts": string[],
  "inferredFacts": string[],
  "searchTerms": string[]
}

Rules:
- "searchTerms": 1-3 short product-search queries (symptom or intended goal). No brand names.
- "allergies": only substances the customer is actually allergic/sensitive to.
- Keep every string short.
- Output json only.`;

export function buildInterpretUserPrompt(
  message: string,
  history: DeepSeekMessage[],
): string {
  const recent = history
    .slice(-4)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");
  return [
    recent ? `Recent conversation:\n${recent}\n` : "",
    `Current message:\n${message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const RESPONSE_SYSTEM_PROMPT = `You are Shiva, a careful pharmacy assistant helping a pharmacist.

You are given:
- the pharmacist's request,
- validated case facts,
- an authoritative safety assessment,
- real product candidates retrieved from the catalog.

Write a concise, helpful reply in Markdown.

Hard rules:
- NEVER invent products, ingredients, brands, prices, availability or dosages.
- Only mention products that appear in the provided candidates, by their exact names.
- Do not contradict or downgrade the safety assessment. If it is HIGH_RISK, lead with the urgency and referral.
- If the safety assessment is UNRESOLVED, ask the provided clarifying questions and describe any products only as provisional.
- If no candidates were provided, say no suitable matching products were found in the current catalog.
- Do not claim a product treats a symptom or is clinically effective without support.
- Keep it short (roughly 60-140 words). Use plain language.`;

export function buildResponseUserPrompt(params: {
  message: string;
  facts: CaseFacts;
  safety: SafetyAssessment;
  products: ProductRecommendation[];
}): string {
  const { message, facts, safety, products } = params;

  const productLines = products.length
    ? products
        .map((item, index) => {
          const names = [
            item.product.name,
            item.product.name_en,
          ]
            .filter(Boolean)
            .join(" / ");
          return `${index + 1}. ${names}${item.product.brand ? ` (${item.product.brand})` : ""} [${item.compatibility}]`;
        })
        .join("\n")
    : "(none found)";

  return [
    `Pharmacist request: ${message}`,
    "",
    `Case facts (json): ${JSON.stringify({
      symptoms: facts.symptoms,
      goal: facts.goal,
      allergies: facts.allergies,
      conditions: facts.conditions,
      medications: facts.medications,
      age: facts.age,
      pregnancy: facts.pregnancy,
      duration: facts.duration,
      missingInformation: facts.missingInformation,
    })}`,
    "",
    `Safety assessment: ${safety.status} — ${safety.explanation}`,
    safety.nextSteps.length ? `Urgent next steps: ${safety.nextSteps.join("; ")}` : "",
    safety.questions.length ? `Questions to ask: ${safety.questions.join(" | ")}` : "",
    "",
    "Retrieved product candidates (the only products you may mention):",
    productLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
