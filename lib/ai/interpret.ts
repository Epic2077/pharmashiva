/**
 * Case interpretation: turn a raw message into validated `CaseFacts`.
 *
 * The model output is treated as untrusted: every field is coerced and clamped
 * before use. On any failure the deterministic heuristics are used instead, so
 * the safety engine and product lookup always have input to work with.
 */

import type {
  CaseFacts,
  CaseInterpretation,
  CaseMemory,
  ModelSafetyConcern,
} from "@/types/ai";
import { extractHeuristicFacts } from "./case-heuristics";
import { isDeepSeekConfigured } from "./config";
import { jsonChatCompletion, type DeepSeekMessage } from "./deepseek.service";
import { getCategoryTree, categoryVocabulary } from "@/lib/darukade/categories";
import { buildInterpretUserPrompt, INTERPRET_SYSTEM_PROMPT } from "./prompts";
import { isResolvedMention, termIsDenied } from "../safety/text.ts";

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
    allergies: unionUnique(fallback.allergies, asStringArray(record.allergies)),
    conditions: asStringArray(record.conditions),
    medications: asStringArray(record.medications),
    age: asAge(record.age) ?? fallback.age,
    pregnancy: asBoolean(record.pregnancy) ?? fallback.pregnancy,
    duration: asString(record.duration) ?? fallback.duration,
    customerName: asString(record.customerName) ?? fallback.customerName,
    missingInformation: asStringArray(record.missingInformation),
    statedFacts: asStringArray(record.statedFacts),
    inferredFacts: asStringArray(record.inferredFacts),
    searchTerms: unionUnique(
      asStringArray(record.searchTerms, 4),
      fallback.searchTerms,
    ).slice(0, 4),
    productQueries: unionUnique(
      asStringArray(record.productQueries, 3),
      fallback.productQueries,
    ).slice(0, 3),
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

/**
 * Coerce the untrusted `safetyConcerns` model field. Anything malformed is
 * dropped; the caller escalates the deterministic assessment with these, so
 * they can never widen product permission by themselves.
 */
export function parseSafetyConcerns(raw: unknown): ModelSafetyConcern[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const list = record.safetyConcerns;
  if (!Array.isArray(list)) return [];

  const out: ModelSafetyConcern[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const severity = entry.severity;
    const reason = asString(entry.reason);
    if (
      (severity !== "emergency" &&
        severity !== "urgent" &&
        severity !== "caution") ||
      !reason
    ) {
      continue;
    }
    const confidence =
      entry.confidence === "low" ||
      entry.confidence === "medium" ||
      entry.confidence === "high"
        ? entry.confidence
        : undefined;
    const concern: ModelSafetyConcern = {
      severity,
      reason: reason.slice(0, 200),
    };
    const id = asString(entry.id);
    const symptom = asString(entry.symptom);
    const nextStep = asString(entry.recommendedNextStep);
    const evidence = asString(entry.evidence);
    const questions = asStringArray(entry.followUpQuestions, 3);
    if (id) concern.id = id.slice(0, 80);
    if (symptom) concern.symptom = symptom.slice(0, 120);
    if (nextStep) concern.recommendedNextStep = nextStep.slice(0, 200);
    if (evidence) concern.evidence = evidence.slice(0, 200);
    if (questions.length) concern.followUpQuestions = questions;
    if (typeof entry.requiresProfessionalEvaluation === "boolean") {
      concern.requiresProfessionalEvaluation =
        entry.requiresProfessionalEvaluation;
    }
    if (confidence) concern.confidence = confidence;
    out.push(concern);
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Coerce the untrusted `followUpQuestions` model field. Short strings only;
 * anything else is dropped (the deterministic protocol questions remain the
 * mandatory floor).
 */
export function parseFollowUpQuestions(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.followUpQuestions)) return [];
  return asStringArray(record.followUpQuestions, 5);
}

/**
 * Drop model-reported symptoms that the current message explicitly denies or
 * reports as resolved. The model is untrusted: "no chest pain" must never
 * become a symptom just because the word "chest pain" appeared.
 */
export function sanitizeSymptoms(
  symptoms: readonly string[],
  message: string,
): string[] {
  return symptoms.filter((symptom) => {
    if (!symptom.trim()) return false;
    if (termIsDenied(message, symptom)) return false;
    if (isResolvedMention(message, symptom)) return false;
    return true;
  });
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
    customerName: model.customerName ?? heuristic.customerName,
    searchTerms: unionUnique(model.searchTerms, heuristic.searchTerms).slice(
      0,
      4,
    ),
    productQueries: unionUnique(
      model.productQueries,
      heuristic.productQueries,
    ).slice(0, 3),
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
  memory?: CaseMemory | null;
}): Promise<CaseInterpretation> {
  const heuristic = extractHeuristicFacts(params.message);
  const fallback: CaseInterpretation = {
    facts: heuristic,
    reasoning: [],
    fallback: true,
    safetyConcerns: [],
    followUpQuestions: [],
  };

  if (!isDeepSeekConfigured()) {
    // No key in this environment (common on a fresh deployment): the
    // deterministic facts still drive safety and retrieval.
    console.warn(
      "[interpret] DEEPSEEK_API_KEY is not set; using deterministic facts",
    );
    return fallback;
  }

  try {
    // Catalog vocabulary is only a wording hint for the prompt. Upstream
    // Darukade can be cold/slow/unreachable in a fresh serverless environment;
    // failing here must NEVER prevent the model from interpreting the case.
    let vocabStr: string | null = null;
    try {
      const vocab = categoryVocabulary(await getCategoryTree(), 60);
      vocabStr = JSON.stringify({
        categories: vocab.categories.slice(0, 40),
        ingredients: vocab.ingredients.slice(0, 30),
      });
    } catch {
      console.warn(
        "[interpret] category vocabulary unavailable; continuing without it",
      );
    }
    const raw = await jsonChatCompletion({
      messages: [
        { role: "system", content: INTERPRET_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildInterpretUserPrompt(
            params.message,
            params.history,
            params.memory,
            vocabStr,
          ),
        },
      ],
      signal: params.signal,
    });

    const parsed = parseCaseFacts(raw, heuristic);
    const facts: CaseFacts = {
      ...parsed,
      symptoms: sanitizeSymptoms(parsed.symptoms, params.message),
    };
    return {
      facts,
      reasoning: [],
      fallback: false,
      safetyConcerns: parseSafetyConcerns(raw),
      followUpQuestions: parseFollowUpQuestions(raw),
    };
  } catch (error) {
    // Never let interpretation failure block safety or retrieval. The reason
    // is logged as a code only (never message content) so a production
    // difference is diagnosable.
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "error";
    console.warn(`[interpret] model interpretation unavailable (${name})`);
    return fallback;
  }
}
