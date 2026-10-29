/**
 * Per-chat case memory.
 *
 * A chat is a conversation about a single case. Facts stated on one turn must
 * remain available on later turns so that vague follow-ups ("it gets worse day
 * by day") are attributed to the right problem ("Sarah's eye pain") — which
 * matters both for red-flag detection and for product search.
 *
 * This module is pure (no server-only imports) so both the pipeline and the
 * client store can use it. The merge is **append-only**: the language model can
 * add facts, but only `mergeMemory` decides what is kept, and it never removes
 * a stated fact. That keeps the safety haystack conservative.
 */

import type { CaseFacts, CaseMemory } from "@/types/ai";

const MAX_PROBLEMS = 8;
const MAX_SYMPTOMS = 12;
const MAX_NUMERIC_LISTS = 12;
const MAX_NOTES = 40;
const MAX_QUERIES = 8;
const MAX_TEXT = 400;

export function emptyMemory(): CaseMemory {
  return {
    customerName: null,
    problems: [],
    symptoms: [],
    duration: null,
    allergies: [],
    conditions: [],
    medications: [],
    age: null,
    pregnancy: null,
    // The customer's own statements, in order. Forms the safety context.
    notes: [],
    // Retrieval queries accumulated across the case.
    productQueries: [],
  };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function cleanList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** Append new entries to a list, de-duplicated (case-insensitive) and capped. */
function appendUnique(
  base: string[],
  additions: readonly (string | null | undefined)[],
  limit: number,
): string[] {
  const seen = new Set(base.map((value) => value.toLowerCase()));
  const out = [...base];
  for (const raw of additions) {
    const text = cleanText(raw);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  // Keep the most recent entries when we exceed the cap, but never reorder.
  return out.length > limit ? out.slice(out.length - limit) : out;
}

/**
 * Coerce an untrusted value (DB jsonb or a stale client payload) into a
 * `CaseMemory`. Anything malformed is dropped rather than trusted.
 */
export function coerceMemory(value: unknown): CaseMemory {
  if (!value || typeof value !== "object") return emptyMemory();
  const record = value as Record<string, unknown>;
  const age = Number(record.age);

  return {
    customerName: cleanText(record.customerName),
    problems: cleanList(record.problems, MAX_PROBLEMS),
    symptoms: cleanList(record.symptoms, MAX_SYMPTOMS),
    duration: cleanText(record.duration),
    allergies: cleanList(record.allergies, MAX_NUMERIC_LISTS),
    conditions: cleanList(record.conditions, MAX_NUMERIC_LISTS),
    medications: cleanList(record.medications, MAX_NUMERIC_LISTS),
    age: Number.isFinite(age) && age > 0 && age < 130 ? Math.round(age) : null,
    pregnancy:
      typeof record.pregnancy === "boolean" ? record.pregnancy : null,
    notes: cleanList(record.notes, MAX_NOTES),
    productQueries: cleanList(record.productQueries, MAX_QUERIES),
    updatedAt: cleanText(record.updatedAt) ?? undefined,
  };
}

export function isEmptyMemory(memory: CaseMemory): boolean {
  return (
    !memory.customerName &&
    memory.problems.length === 0 &&
    memory.symptoms.length === 0 &&
    memory.notes.length === 0
  );
}

/**
 * Fold one turn's facts into the case memory. Add-only: `previous` entries are
 * preserved, so a red flag raised earlier in the chat cannot disappear later.
 */
export function mergeMemory(
  previous: CaseMemory | null | undefined,
  facts: CaseFacts,
  message: string,
): CaseMemory {
  const prev = previous ?? emptyMemory();
  const problems = [facts.goal, ...facts.symptoms];

  return {
    customerName: prev.customerName ?? cleanText(facts.customerName),
    problems: appendUnique(prev.problems, problems, MAX_PROBLEMS),
    symptoms: appendUnique(prev.symptoms, facts.symptoms, MAX_SYMPTOMS),
    // Duration/progression is a moving value, so the newest statement wins.
    duration: cleanText(facts.duration) ?? prev.duration,
    allergies: appendUnique(prev.allergies, facts.allergies, MAX_NUMERIC_LISTS),
    conditions: appendUnique(
      prev.conditions,
      facts.conditions,
      MAX_NUMERIC_LISTS,
    ),
    medications: appendUnique(
      prev.medications,
      facts.medications,
      MAX_NUMERIC_LISTS,
    ),
    age: facts.age ?? prev.age,
    pregnancy: facts.pregnancy ?? prev.pregnancy,
    notes: appendUnique(prev.notes, [...facts.statedFacts, message], MAX_NOTES),
    productQueries: appendUnique(
      prev.productQueries,
      facts.productQueries,
      MAX_QUERIES,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Project the memory back into the `CaseFacts` shape the deterministic safety
 * engine and the retrieval layer consume. `statedFacts` carries every note so
 * the red-flag haystack covers the whole case, not just the last message.
 */
export function memoryToFacts(memory: CaseMemory): CaseFacts {
  return {
    summary: memory.problems.join("; "),
    symptoms: memory.symptoms,
    goal: memory.problems[0] ?? null,
    category: null,
    allergies: memory.allergies,
    conditions: memory.conditions,
    medications: memory.medications,
    age: memory.age,
    pregnancy: memory.pregnancy,
    duration: memory.duration,
    missingInformation: [],
    statedFacts: memory.notes,
    inferredFacts: [],
    // Search terms are the symptom history (used as a deterministic fallback
    // for retrieval and medical reference). `productQueries` in memory is
    // historical context only — it must NOT be replayed as though it were the
    // current turn's search intent (that bug made a stale "eye supplement"
    // query displace fresh symptom-driven results).
    searchTerms: memory.symptoms,
    productQueries: [],
    customerName: memory.customerName,
  };
}

/** Compact string used for prompts and the safety haystack. */
export function memoryContext(memory: CaseMemory): string {
  const parts: string[] = [];
  if (memory.customerName) parts.push(`Customer: ${memory.customerName}`);
  if (memory.problems.length) parts.push(`Problem: ${memory.problems.join("; ")}`);
  if (memory.symptoms.length) parts.push(`Symptoms: ${memory.symptoms.join("; ")}`);
  if (memory.duration) parts.push(`Duration/progression: ${memory.duration}`);
  if (memory.allergies.length) parts.push(`Allergies: ${memory.allergies.join("; ")}`);
  if (memory.conditions.length) parts.push(`Conditions: ${memory.conditions.join("; ")}`);
  if (memory.medications.length) parts.push(`Medications: ${memory.medications.join("; ")}`);
  if (memory.age !== null) parts.push(`Age: ${memory.age}`);
  if (memory.pregnancy !== null) parts.push(`Pregnancy: ${memory.pregnancy ? "yes" : "no"}`);
  if (memory.notes.length) parts.push(`Stated: ${memory.notes.join(" | ")}`);
  return parts.join("\n");
}
