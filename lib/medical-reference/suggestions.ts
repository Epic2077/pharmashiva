/**
 * Curated suggestion terms for the Medical Reference search input.
 *
 * The public medical sources are almost entirely English, so every suggestion
 * carries a canonical English `label` (the term that is actually searched) plus
 * an optional Persian `fa` label for display in the Farsi UI. The list is small
 * and curated: it only contains terms the sources reliably cover, so an
 * autocomplete suggestion can never promise coverage the search can't deliver.
 *
 * This module is client-safe: it imports only types and pure functions, so the
 * search-bar client component can import it freely.
 */

import type { ReferenceFilter } from "./types";

export interface ReferenceSuggestion {
  /** Canonical English term that is actually submitted as the query. */
  label: string;
  /** Persian display label (shown when the UI language is Farsi). */
  fa?: string;
  /** The search category this term belongs to. */
  filter: ReferenceFilter;
}

/** Bilingual category labels for the suggestion rows. */
export const REFERENCE_FILTER_LABEL: Record<
  ReferenceFilter,
  { en: string; fa: string }
> = {
  all: { en: "All", fa: "همه" },
  conditions: { en: "Condition", fa: "بیماری" },
  definitions: { en: "Definition", fa: "تعریف" },
  drugs: { en: "Drug", fa: "دارو" },
  supplements: { en: "Supplement", fa: "مکمل" },
  research: { en: "Research", fa: "پژوهش" },
};

/**
 * Curated terms, roughly ordered so common searches appear first. The first few
 * entries double as the "popular" list shown when the input is empty.
 */
export const REFERENCE_SUGGESTIONS: ReferenceSuggestion[] = [
  // Conditions & symptoms
  { label: "headache", fa: "سردرد", filter: "conditions" },
  { label: "diabetes", fa: "دیابت", filter: "conditions" },
  { label: "high blood pressure", fa: "فشار خون بالا", filter: "conditions" },
  { label: "aspirin", fa: "آسپرین", filter: "drugs" },
  { label: "ibuprofen", fa: "ایبوپروفن", filter: "drugs" },
  { label: "vitamin d", fa: "ویتامین دی", filter: "supplements" },
  { label: "fever", fa: "تب", filter: "conditions" },
  { label: "cough", fa: "سرفه", filter: "conditions" },
  { label: "sore throat", fa: "گلودرد", filter: "conditions" },
  { label: "asthma", fa: "آسم", filter: "conditions" },
  { label: "allergy", fa: "آلرژی", filter: "conditions" },
  { label: "migraine", fa: "میگرن", filter: "conditions" },
  { label: "anemia", fa: "کم خونی", filter: "conditions" },
  { label: "eczema", fa: "اگزما", filter: "conditions" },
  { label: "diarrhea", fa: "اسهال", filter: "conditions" },
  { label: "constipation", fa: "یبوست", filter: "conditions" },
  { label: "nausea", fa: "تهوع", filter: "conditions" },
  { label: "acid reflux", fa: "رفلاکس معده", filter: "conditions" },
  { label: "insomnia", fa: "بی خوابی", filter: "conditions" },
  { label: "anxiety", fa: "اضطراب", filter: "conditions" },
  { label: "depression", fa: "افسردگی", filter: "conditions" },
  { label: "arthritis", fa: "آرتریت", filter: "conditions" },
  { label: "psoriasis", fa: "پسوریازیس", filter: "conditions" },
  { label: "chest pain", fa: "درد قفسه سینه", filter: "conditions" },

  // Medical definitions
  { label: "inflammation", fa: "التهاب", filter: "definitions" },
  { label: "hypertension", fa: "پرفشاری خون", filter: "definitions" },
  { label: "antibiotic", fa: "آنتی بیوتیک", filter: "definitions" },
  { label: "antihistamine", fa: "آنتی هیستامین", filter: "definitions" },
  { label: "cholesterol", fa: "کلسترول", filter: "definitions" },

  // Drugs & ingredients
  { label: "acetaminophen", fa: "استامینوفن", filter: "drugs" },
  { label: "metformin", fa: "متفورمین", filter: "drugs" },
  { label: "amoxicillin", fa: "آموکسی سیلین", filter: "drugs" },
  { label: "atorvastatin", fa: "آتورواستاتین", filter: "drugs" },
  { label: "omeprazole", fa: "امپرازول", filter: "drugs" },
  { label: "losartan", fa: "لوزارتان", filter: "drugs" },
  { label: "insulin", fa: "انسولین", filter: "drugs" },

  // Supplements
  { label: "vitamin c", fa: "ویتامین سی", filter: "supplements" },
  { label: "vitamin b12", fa: "ویتامین ب۱۲", filter: "supplements" },
  { label: "omega-3", fa: "امگا ۳", filter: "supplements" },
  { label: "zinc", fa: "زینک", filter: "supplements" },
  { label: "iron", fa: "آهن", filter: "supplements" },
  { label: "magnesium", fa: "منیزیم", filter: "supplements" },
  { label: "calcium", fa: "کلسیم", filter: "supplements" },
  { label: "creatine", fa: "کراتین", filter: "supplements" },
  { label: "probiotic", fa: "پروبیوتیک", filter: "supplements" },
  { label: "melatonin", fa: "ملاتونین", filter: "supplements" },
];

/**
 * Popular terms shown when the input is focused but still empty. Returns a
 * small, stable subset so the autocomplete invites exploration without
 * overwhelming a first-time visitor.
 */
export function popularReferenceTerms(limit = 6): ReferenceSuggestion[] {
  return REFERENCE_SUGGESTIONS.slice(0, limit);
}

/**
 * Rank matching suggestions for a free-text fragment. Prefix matches win over
 * substring matches, and a Persian fragment is matched against the Persian
 * label directly (no server round-trip needed).
 */
export function suggestReferenceTerms(
  input: string,
  limit = 8,
): ReferenceSuggestion[] {
  const raw = input.trim();
  if (!raw) return [];

  const lowered = raw.toLowerCase();
  const scored: { suggestion: ReferenceSuggestion; score: number }[] = [];

  for (const suggestion of REFERENCE_SUGGESTIONS) {
    const en = suggestion.label.toLowerCase();
    const fa = suggestion.fa ?? "";
    let score = -1;
    if (en.startsWith(lowered)) {
      score = 0;
    } else if (fa && fa.includes(raw)) {
      score = 1;
    } else if (en.includes(lowered)) {
      score = 2;
    }
    if (score >= 0) scored.push({ suggestion, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((entry) => entry.suggestion);
}
