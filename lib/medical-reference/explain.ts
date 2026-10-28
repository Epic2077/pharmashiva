/**
 * Grounded AI explanation for a Medical Reference detail page.
 *
 * The model is given only the retrieved source text for the single record and
 * is asked to explain it in plain language. The result is clearly labeled as an
 * AI explanation — never as source fact — and the function returns an empty
 * result whenever the AI is not configured or fails, so the page still renders
 * the source sections on their own.
 */

import {
  AI_TIMEOUTS,
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  isDeepSeekConfigured,
} from "@/lib/ai/config";
import type { MedicalReference, MedicalReferenceDetail } from "./types";

const EXPLAIN_SYSTEM_PROMPT = `You are Shiva, a clinical pharmacy assistant. A pharmacist has opened a medical reference record. Explain it in plain, accessible language.

Hard rules:
- Base your explanation ONLY on the provided source text. Never invent facts, studies, dosages, or warnings.
- Distinguish established source information from anything uncertain; never present an unsupported claim as fact.
- Do not diagnose or make treatment recommendations. Say when professional evaluation is warranted.
- Keep it under 150 words. Use Markdown.`;

export interface ReferenceExplanation {
  text: string;
  generated: boolean;
}

export async function explainReference(
  detail: MedicalReferenceDetail,
  reference: MedicalReference,
): Promise<ReferenceExplanation> {
  if (!isDeepSeekConfigured()) {
    return { text: "", generated: false };
  }

  const sourceText = detail.sections
    .map((section) => `${section.heading}:\n${section.body}`)
    .join("\n\n")
    .slice(0, 6_000);
  if (!sourceText.trim()) {
    return { text: "", generated: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      AI_TIMEOUTS.respondMs,
    );
    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          stream: false,
          max_tokens: 500,
          thinking: { type: "disabled" },
          reasoning_effort: "none",
          messages: [
            { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Record title: ${reference.title}\nSource: ${reference.sourceLabel}\n\nSource text:\n${sourceText}`,
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) return { text: "", generated: false };
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      return text ? { text, generated: true } : { text: "", generated: false };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { text: "", generated: false };
  }
}
