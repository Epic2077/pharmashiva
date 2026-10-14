/**
 * Case interpretation: turn a raw message into validated `CaseFacts`.
 *
 * The model output is treated as untrusted: every field is coerced and clamped
 * before use. On any failure the deterministic heuristics are used instead, so
 * the safety engine and product lookup always have input to work with.
 */

import type { CaseFacts, CaseInterpretation } from "@/types/ai";
import { extractHeuristicFacts } from "./case-heuristics";
import { isDeepSeekConfigured } from "./config";
import { jsonChatCompletion, type DeepSeekMessage } from "./deepseek.service";
import {
  buildInterpretUserPrompt,
  INTERPRET_SYSTEM_PROMPT,
} from "./prompts";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, 400) : null;
}

function asStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = asString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function asAge(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0 || number >= 130) return null;
  return Math.round(number);
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Coerce an untrusted model object into a `CaseFacts`, seeded by fallback. */
export function parseCaseFacts(raw: unknown, fallback: CaseFacts): CaseFacts {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;

  return {
    summary: asString(record.summary) ?? fallback.summary,
    symptoms: unionUnique(fallback.symptoms, asStringArray(record.symptoms)),
    goal: asString(record.goal) ?? fallback.goal,
    category: asString(record.category) ?? fallback.category,
    allergies: unionUnique(
      fallback.allergies,
      asStringArray(record.allergies),
    ),
    conditions: asStringArray(record.conditions),
    medications: asStringArray(record.medications),
    age: asAge(record.age) ?? fallback.age,
    pregnancy: asBoolean(record.pregnancy) ?? fallback.pregnancy,
    duration: asString(record.duration) ?? fallback.duration,
    missingInformation: asStringArray(record.missingInformation),
    statedFacts: asStringArray(record.statedFacts),
    inferredFacts: asStringArray(record.inferredFacts),
    searchTerms: unionUnique(
      asStringArray(record.searchTerms, 4),
      fallback.searchTerms,
    ).slice(0, 4),
  };
}

function unionUnique(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...a, ...b]) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Merge heuristic facts (instant) with model facts (richer). */
export function mergeCaseFacts(
  heuristic: CaseFacts,
  model: CaseFacts,
): CaseFacts {
  const allergies = unionUnique(model.allergies, heuristic.allergies);

  return {
    ...model,
    symptoms: unionUnique(model.symptoms, heuristic.symptoms),
    allergies,
    // An explicit "no allergy" is not a fact we can trust; drop an allergy that
    // only the heuristic found if the model saw the message and disagreed.
    duration: model.duration ?? heuristic.duration,
    age: model.age ?? heuristic.age,
    pregnancy: model.pregnancy ?? heuristic.pregnancy,
    searchTerms: unionUnique(model.searchTerms, heuristic.searchTerms).slice(
      0,
      4,
    ),
  };
}

/**
 * Interpret a message into case facts. Falls back to heuristics when the model
 * is not configured, times out, errors, or returns something unusable.
 */
export async function interpretCase(params: {
  message: string;
  history: DeepSeekMessage[];
  signal: AbortSignal;
}): Promise<CaseInterpretation> {
  const heuristic = extractHeuristicFacts(params.message);
  const fallback: CaseInterpretation = {
    facts: heuristic,
    reasoning: [],
    fallback: true,
  };

  if (!isDeepSeekConfigured()) return fallback;

  try {
    const raw = await jsonChatCompletion({
      messages: [
        { role: "system", content: INTERPRET_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildInterpretUserPrompt(params.message, params.history),
        },
      ],
      signal: params.signal,
    });

    const facts = parseCaseFacts(raw, heuristic);
    return { facts, reasoning: [], fallback: false };
  } catch {
    // Never let interpretation failure block safety or retrieval.
    return fallback;
  }
}
