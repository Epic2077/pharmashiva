/**
 * Prompt construction for the consultation pipeline.
 *
 * Prompts are kept short and contain only the context needed for the current
 * request, to protect latency and cost. Nothing here is logged.
 */

import type {
  CaseFacts,
  CaseMemory,
  ProductDisplayPolicy,
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
  "productQueries": string[],
  "safetyConcerns": { "severity": "emergency" | "urgent" | "caution", "reason": string }[],
  "followUpQuestions": string[]
}

Rules:
- "customerName": the customer's name, only if the pharmacist names them; otherwise null.
- "symptoms": only symptoms the customer is CURRENTLY experiencing. Exclude negated symptoms ("no chest pain"), hypothetical examples, quotations, historical symptoms that have resolved, and symptoms belonging to somebody else.
- "statedFacts": quote the customer's own words for the facts that are actually present.
- "searchTerms": 1-3 short symptom-based lookup phrases. No brand names.
- "productQueries": 1-3 short, plain phrases naming the product class, category or active ingredient that would actually help THIS case (for example "eye drops" for eye pain, "antihistamine" for an allergy). Write them in the same language as the customer's message. The catalog vocabulary provided below is only an optional wording hint: use a term from it only when it genuinely fits the case, and never let it pull you towards an unrelated product. If the pharmacist asks about a specific named product (for example "does this product contain X?"), you may include that exact product name as a productQuery so it can be looked up and checked. Otherwise avoid figurative or ambiguous wording and never use brand names.
- "allergies": only substances the customer is actually allergic/sensitive to.Generate focused questions for every detected concern that still needs information: red/painful eyes (pain, vision, light sensitivity, injury/chemical exposure, contact lenses), possible medicine interactions (names, doses, other products), suspected allergy (substance, reaction, timing, current warning signs), skin concerns (appearance, spread, pain, fever, exposure), and gastrointestinal symptoms (severity, duration, bleeding, vomiting, hydration). Ask only what is relevant to THIS case, never a fixed script, and never repeat something already answered. Return [] when a short keyword request is fully actionable or when an emergency next step takes precedence (the deterministic layer still appends safe protocol questions after emergency guidance)
- "safetyConcerns": what deterministic keyword rules may miss. Only flag a concern when it genuinely needs a check before a product can be suggested: possible drug/drug or drug/supplement interactions, contraindications with pregnancy, age or the customer's conditions, or unusual symptom patterns that need professional review. Never flag ordinary benign shopping requests or symptoms the customer is already managing with medical care. Be specific ("the customer takes warfarin; any supplement containing vitamin K needs checking"). "emergency" only for life- or vision-threatening signals; "urgent" when prompt professional assessment is needed; otherwise "caution". Use [] when nothing needs flagging. Never flag allergies or ingredient sensitivities — the product filter already excludes them automatically; only flag an allergy when there are signs of a current severe allergic reaction.
- "followUpQuestions": the exact questions the pharmacist should ask to resolve this case safely (0-3, in the message's language). Only when a specific, safety-critical fact is missing (for example a possible interaction or contraindication). A named symptom or a short keyword-style message is NOT a reason to ask questions — the pharmacist works in keywords and expects suggestions immediately, so return [] for those. Do not ask questions when the case is an emergency or urgent referral, and do not ask what the pharmacist already told you.
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
- Lead with the result. If the assessment identified a red flag, state it and the recommended action first; otherwise go straight to the product suggestions. Never open by asking for more information and never ask the pharmacist to explain the case further.
- The product display policy is provided. "show_relevant_products" means the candidates are primary. "show_with_safety_context" means the safety concern comes first and the candidates are secondary: state clearly that they are not a treatment for the unresolved symptom and must not delay the recommended care. "no_relevant_products" means say honestly that no suitable match was found — never invent or force a product.
- Only include questions when the safety assessment lists them, and then put them after the safety next step / product context — the suggestions must not be presented as conditional on them.
- Never imply a cosmetic, supplement or general product treats an unresolved red-flag symptom.
- Do not claim a product treats a symptom or is clinically effective unless the product's own catalog data supports that intended use. A product may only be described by its catalog category and ingredient facts.
- If ingredient data is missing (compatibility unknown), say it cannot be confirmed — never guess.
- If no candidates were provided, say no suitable matching products were found in the current catalog.
- Keep it short (roughly 60-140 words). Use plain language.`;

export function buildResponseUserPrompt(params: {
  message: string;
  facts: CaseFacts;
  safety: SafetyAssessment;
  products: ProductRecommendation[];
  displayPolicy?: ProductDisplayPolicy;
}): string {
  const { message, facts, safety, products, displayPolicy } = params;

  // Keep the prompt compact: only the most recent statements of the case.
  const statedFacts = facts.statedFacts.slice(-6);

  const productLines = (() => {
    if (products.length === 0) return "(none found)";
    return products
      .map((item, index) => {
        const names = [item.product.name, item.product.name_en]
          .filter(Boolean)
          .join(" / ");
        const ingredientSummary = item.product.ingredients
          .map((ingredient) =>
            [ingredient.name, ingredient.name_en, ingredient.name_fa]
              .filter(Boolean)
              .slice(0, 1)
              .join(""),
          )
          .filter(Boolean)
          .slice(0, 6)
          .join(", ");
        const parts = [
          `${index + 1}. ${names}${item.product.brand ? ` (${item.product.brand})` : ""} [${item.compatibility}]`,
        ];
        if (ingredientSummary) {
          parts.push(`   ingredients: ${ingredientSummary}`);
        } else if (item.compatibility === "unknown") {
          parts.push("   ingredient data: unavailable — cannot be confirmed");
        }
        if (item.warnings.length) {
          parts.push(`   warnings: ${item.warnings.join("; ")}`);
        }
        return parts.join("\n");
      })
      .join("\n");
  })();

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
    `Safety assessment: ${safety.status} (${safety.level}) — ${safety.explanation}`,
    safety.nextSteps.length
      ? `Urgent next steps: ${safety.nextSteps.join("; ")}`
      : "",
    safety.questions.length
      ? `Questions to ask: ${safety.questions.join(" | ")}`
      : "",
    displayPolicy ? `Product display policy: ${displayPolicy}` : "",
    "",
    "Retrieved product candidates (the only products you may mention):",
    productLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
