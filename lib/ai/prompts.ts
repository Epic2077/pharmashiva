/**
 * Prompt construction for the consultation pipeline.
 *
 * Prompts are kept short and contain only the context needed for the current
 * request, to protect latency and cost. Nothing here is logged.
 */

import type {
  CaseFacts,
  CaseMemory,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";
import { memoryContext } from "@/lib/chat/memory";
import type { DeepSeekMessage } from "./deepseek.service";

/**
 * Interpretation prompt. Must mention "json" (DeepSeek JSON mode requirement)
 * and describe the exact shape we validate against.
 */
export const INTERPRET_SYSTEM_PROMPT = `You are a clinical case interpreter for a pharmacist assistant.

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
  "customerName": string | null,
  "missingInformation": string[],
  "statedFacts": string[],
  "inferredFacts": string[],
  "searchTerms": string[],
  "productQueries": string[]
}

Rules:
- "customerName": the customer's name, only if the pharmacist names them; otherwise null.
- "searchTerms": 1-3 short symptom-based lookup phrases. No brand names.
- "productQueries": 1-3 short, plain phrases naming the product class, category or active ingredient that would actually help THIS case (for example "eye drops" for eye pain, "antihistamine" for an allergy). Write them in the same language as the customer's message. The catalog vocabulary provided below is only an optional wording hint: use a term from it only when it genuinely fits the case, and never let it pull you towards an unrelated product. Avoid figurative or ambiguous wording and never use brand names.
- "allergies": only substances the customer is actually allergic/sensitive to.
- Keep every string short.
- Output json only.`;

export function buildInterpretUserPrompt(
  message: string,
  history: DeepSeekMessage[],
  memory?: CaseMemory | null,
  catalogVocabulary?: string | null,
): string {
  const recent = history
    .slice(-4)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");
  const known = memory ? memoryContext(memory) : "";
  return [
    recent ? `Recent conversation:\n${recent}\n` : "",
    known ? `Already known about this case:\n${known}\n` : "",
    `Current message:\n${message}\n`,
    catalogVocabulary
      ? `Catalog vocabulary (optional wording hints for "category" and "productQueries" — ignore any term that does not fit the case):\n${catalogVocabulary}\n`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const RESPONSE_SYSTEM_PROMPT = `You are Shiva, a careful pharmacy assistant helping a pharmacist you are made by Ashkan Sadeghi.

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

  // Keep the prompt compact: only the most recent statements of the case.
  const statedFacts = facts.statedFacts.slice(-6);

  const productLines = products.length
    ? products
        .map((item, index) => {
          const names = [item.product.name, item.product.name_en]
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
      customerName: facts.customerName,
      symptoms: facts.symptoms,
      goal: facts.goal,
      allergies: facts.allergies,
      conditions: facts.conditions,
      medications: facts.medications,
      age: facts.age,
      pregnancy: facts.pregnancy,
      duration: facts.duration,
      missingInformation: facts.missingInformation,
      statedFacts,
    })}`,
    "",
    `Safety assessment: ${safety.status} — ${safety.explanation}`,
    safety.nextSteps.length
      ? `Urgent next steps: ${safety.nextSteps.join("; ")}`
      : "",
    safety.questions.length
      ? `Questions to ask: ${safety.questions.join(" | ")}`
      : "",
    "",
    "Retrieved product candidates (the only products you may mention):",
    productLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
