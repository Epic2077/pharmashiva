/**
 * Deterministic, instant case extraction.
 *
 * Two jobs:
 *   1. Give the pipeline something to search the database with *immediately*,
 *      before the model has finished interpreting the message.
 *   2. Act as a safe fallback when the model is unavailable, so the safety
 *      engine and product lookup still run.
 *
 * It never invents facts — it only lifts terms that literally appear.
 */

import type { CaseFacts } from "@/types/ai";
import {
  hasUnnegatedTerm,
  isResolvedMention,
  normaliseHealthText,
  unnegatedPattern,
} from "../safety/text.ts";

const SYMPTOM_TERMS: string[] = [
  "headache",
  "migraine",
  "stomach pain",
  "abdominal pain",
  "nausea",
  "vomiting",
  "diarrhea",
  "diarrhoea",
  "constipation",
  "cough",
  "cold",
  "fever",
  "sore throat",
  "rash",
  "itching",
  "insomnia",
  "anxiety",
  "joint pain",
  "back pain",
  "muscle pain",
  "period pain",
  "cramp",
  "heartburn",
  "reflux",
  "bloating",
  "fatigue",
  "dizziness",
  "runny nose",
  "sneezing",
  "acne",
  "hair loss",
  "dry hair",
  "dry scalp",
  "frizzy hair",
  "split ends",
  "hair fall",
  "dandruff",
  "dry skin",
  "oily skin",
  "sensitive skin",
  "eczema",
  "psoriasis",
  "dark spots",
  "wrinkles",
  "red eye",
  "red eyes",
  "eye redness",
  "eye pain",
  "eye hurts",
  "eye hurting",
  "eye ache",
  "eye aches",
  "eyes hurt",
  "eyes hurting",
  "eyes are hurting",
  "painful eye",
  "painful eyes",
  "sore eye",
  "sore eyes",
  "eye discomfort",
  "eye irritation",
  "blurred vision",
  "blurry vision",
  "سردرد",
  "قرمزی چشم",
  "درد چشم",
  "خشکی مو",
  "موخوره",
  "شوره",
  "ریزش مو",
  "پوست خشک",
  "پوست چرب",
  "چین و چروک",
  "چشم درد",
  "چشمم درد",
  "چشمام درد",
  "چشم هام درد",
  "سوزش چشم",
  "تاری دید",
  "معده",
  "درد",
  "تهوع",
  "اسهال",
  "یبوست",
  "سرفه",
  "سرماخوردگی",
  "تب",
  "گلودرد",
  "خارش",
  "بی خوابی",
  "اضطراب",
  "عفونت",
];

/**
 * Order-independent phrasings that the exact list above cannot express
 * ("my hair is very dry", "eyes are really hurting"). Each pattern is still
 * negation/hypothesis-aware and maps to a canonical symptom label.
 */
const SYMPTOM_PATTERNS: Array<{ pattern: RegExp; symptom: string }> = [
  {
    pattern:
      /\b(?:eye|eyes|ocular)\b[^.!?\n]{0,24}\b(?:pain|painful|hurt|hurts|hurting|ache|aches|aching|sore|discomfort|irritat\w*)\b|\b(?:pain|painful|hurt|hurts|hurting|ache|aches|aching|sore|discomfort|irritat\w*)\b[^.!?\n]{0,24}\b(?:eye|eyes|ocular)\b|درد چشم|چشم درد|سوزش چشم/i,
    symptom: "eye pain",
  },
  {
    pattern:
      /\b(?:dry|damaged|frizzy|brittle)\b[^.!?\n]{0,24}\b(?:hair|scalp)\b|\b(?:hair|scalp)\b[^.!?\n]{0,24}\b(?:dry|damaged|frizzy|brittle)\b|خشکی مو|مو(?:م|ت|ش|اش|هام)? خشک|موخوره|شوره/i,
    symptom: "dry hair",
  },
  {
    pattern:
      /\b(?:dry|oily|sensitive)\b[^.!?\n]{0,24}\bskin\b|\bskin\b[^.!?\n]{0,24}\b(?:dry|oily|sensitive)\b|پوست (?:خشک|چرب|حساس)/i,
    symptom: "dry skin",
  },
];

/** Any word that signals the sentence is about an allergy. */
const ALLERGY_WORD = "(?:allerg\\w*|intoleran\\w*|حساس(?:یت)?)";

/**
 * Negations. "no known allergies" and "not allergic to X" must not be read as
 * allergies — that would be the opposite of the truth and could hide a real
 * product from the customer.
 */
const NEGATION =
  /\b(?:no|not|none|never|without|nkda|denies|denied|negative|ندارد|ندارم|ندارند|بدون|هیچ|نیست)\b/i;

/** Filler words that can never be the allergen themselves. */
const ALLERGEN_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "from",
  "with",
  "of",
  "has",
  "have",
  "had",
  "is",
  "are",
  "was",
  "were",
  "and",
  "or",
  "but",
  "who",
  "that",
  "which",
  "so",
  "for",
  "about",
  "against",
  "my",
  "his",
  "her",
  "their",
  "our",
  "your",
  "customer",
  "patient",
  "client",
  "person",
  "she",
  "he",
  "they",
  "i",
  "we",
  "you",
  "it",
  "this",
  "there",
  "very",
  "known",
  "no",
  "not",
  "به",
  "از",
  "با",
  "که",
  "و",
  "یا",
  "ولی",
  "این",
  "آن",
  "دارد",
  "داره",
  "دارند",
  "نیز",
  "هم",
  "مشتری",
  "بیمار",
  "شخص",
  "او",
  "برای",
  "یک",
  "هست",
  "است",
  "بود",
]);

const ALLERGY_CONNECTOR = /,|\b(?:and|or|but|who|which|that|so)\b/i;

/**
 * Reduce a candidate phrase to a short allergen name.
 *
 * `side` decides which end of the phrase to keep: allergens that follow the
 * keyword ("allergic to **X**") are read left-to-right, while allergens that
 * precede it ("**X** allergy") live next to the keyword, so we keep the tail.
 */
function reduceAllergenPhrase(
  raw: string,
  side: "before" | "after",
): string | null {
  if (NEGATION.test(raw)) return null;

  const phrase = raw.replace(/[\u200b\u200c\u200e\u200f]/g, " ").trim();
  const tokens = phrase
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (token) =>
        token.length >= 2 && !ALLERGEN_STOPWORDS.has(token.toLowerCase()),
    );
  if (tokens.length === 0) return null;

  const chosen = side === "after" ? tokens.slice(0, 3) : tokens.slice(-3);
  const value = chosen.join(" ").trim();
  return value.length >= 2 ? value.slice(0, 60) : null;
}

function extractAllergies(text: string): string[] {
  const source = normaliseHealthText(text);
  const found: string[] = [];

  const negatedAround = (index: number, length: number): boolean => {
    const before = source.slice(Math.max(0, index - 18), index);
    const after = source.slice(index + length, index + length + 18);
    return NEGATION.test(before) || NEGATION.test(after);
  };

  const addPhrase = (raw: string | undefined, side: "before" | "after") => {
    if (!raw) return;
    const segments = raw.split(ALLERGY_CONNECTOR);
    const chosen =
      side === "after" ? segments : [segments[segments.length - 1] ?? ""];
    for (const segment of chosen) {
      const phrase = reduceAllergenPhrase(segment, side);
      if (phrase) found.push(phrase);
      if (found.length >= 6) return;
    }
  };

  // "allergic to X", "allergy to X", "حساسیت به X" — allergen follows keyword.
  for (const match of source.matchAll(
    /allerg\w*\s*to\s*([^\n.;!?。،]{2,60})/gi,
  )) {
    if (!negatedAround(match.index ?? 0, match[0].length)) {
      addPhrase(match[1], "after");
    }
  }
  for (const match of source.matchAll(
    /حساس(?:یت)?\s*به\s*([^\n.;!?。،]{2,60})/g,
  )) {
    if (!negatedAround(match.index ?? 0, match[0].length)) {
      addPhrase(match[1], "after");
    }
  }

  // "X allergy", "X intolerance", "X حساسیت" — allergen precedes keyword.
  for (const match of source.matchAll(
    new RegExp(`([^\\n.;!?。،]{2,60}?)\\s*${ALLERGY_WORD}`, "gi"),
  )) {
    if (!negatedAround(match.index ?? 0, match[0].length)) {
      addPhrase(match[1], "before");
    }
  }

  return unique(found).slice(0, 6);
}

const DURATION_PATTERNS: RegExp[] = [
  /\b(?:for|since)\s+(\d+\s*(?:hour|day|week|month|year)s?|[a-z]+\s+(?:day|week|month|year)s?)\b/i,
  /\b(\d+\s*(?:hour|day|week|month|year)s?)\b/i,
  /(\d+\s*(?:ساعت|روز|هفته|ماه|سال))/,
];

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

/**
 * Negation- and history-aware symptom extraction. "no red eyes" and
 * "chest pain last week, resolved" must not become active symptoms: doing so
 * would re-inject a denied finding into every later turn through memory.
 */
export function extractSymptoms(text: string): string[] {
  const exact = SYMPTOM_TERMS.filter((term) => {
    if (!hasUnnegatedTerm(text, term)) return false;
    if (isResolvedMention(text, term)) return false;
    return true;
  });
  const patterned = SYMPTOM_PATTERNS.filter((entry) =>
    unnegatedPattern(entry.pattern, text),
  ).map((entry) => entry.symptom);
  return unique([...exact, ...patterned]);
}

function extractAge(text: string): number | null {
  const match =
    text.match(/(\d{1,3})\s*(?:-|\s)?\s*(?:year|yr|y\/o|yo|years old)\b/i) ??
    text.match(/(\d{1,3})\s*(?:ساله|سال)/);
  if (!match) return null;
  const age = Number(match[1]);
  return Number.isFinite(age) && age > 0 && age < 130 ? age : null;
}

function extractPregnancy(text: string): boolean | null {
  if (
    /pregnan|breastfeed|breast-feeding|lactat|باردار|شیرده|شيرده/i.test(text)
  ) {
    return true;
  }
  return null;
}

function extractDuration(text: string): string | null {
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return null;
}

/**
 * Search terms for the deterministic path. Only curated symptom terms are
 * used — never the raw message sentence, which matched catalog noise (e.g.
 * promoted beauty products for "Ali's eyes are red").
 */
function buildSearchTerms(message: string, symptoms: string[]): string[] {
  void message;
  return unique(symptoms).slice(0, 3);
}

/**
 * Extract case facts from a raw message without any model call.
 */
export function extractHeuristicFacts(message: string): CaseFacts {
  const symptoms = extractSymptoms(message);
  const allergies = extractAllergies(message);
  const age = extractAge(message);
  const pregnancy = extractPregnancy(message);
  const duration = extractDuration(message);

  return {
    summary: message.trim().slice(0, 400),
    symptoms,
    goal: symptoms.length > 0 ? message.trim().slice(0, 160) : null,
    category: null,
    allergies,
    conditions: [],
    medications: [],
    age,
    pregnancy,
    duration,
    customerName: null,
    missingInformation: [],
    statedFacts: [],
    inferredFacts: [],
    searchTerms: buildSearchTerms(message, symptoms),
    // The model is the only thing that turns a case into *product* queries
    // (active ingredient / product class / category). Heuristics cannot, so they
    // leave this empty rather than feeding the raw message to product search —
    // which would match noise (e.g. "10" in "10/10") and bury the real products.
    productQueries: [],
  };
}
