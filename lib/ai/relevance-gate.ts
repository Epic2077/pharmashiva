/**
 * Deterministic product relevance gate.
 *
 * Safety and relevance are separate requirements: a `routine` safety
 * assessment does not make every product appropriate. Before any candidate
 * may be shown, it must be justifiable from the case:
 *
 *  1. token overlap with the executed query / symptom,
 *  2. a symptom-domain match (e.g. an eye product for an eye symptom),
 *  3. scope compatibility (beauty vs supplement vs symptom shopping).
 *
 * This module is pure and performs no IO. Name similarity or general
 * beauty/wellness relevance is never treated as proof of suitability, and
 * nothing here can invent an indication for a product.
 */

import type {
  CaseFacts,
  RelevanceDecisionCode,
  RelevanceVerdict,
  ShoppingIntent,
} from "@/types/ai";
import type { ProductDetails } from "@/types/database";
import { normalizeIngredient } from "./ingredients.ts";

/* ── Vocabularies ─────────────────────────────────────────────── */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "have",
  "has",
  "had",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "my",
  "our",
  "your",
  "his",
  "her",
  "their",
  "its",
  "me",
  "you",
  "him",
  "she",
  "he",
  "they",
  "we",
  "i",
  "it",
  "this",
  "that",
  "these",
  "those",
  "about",
  "after",
  "before",
  "does",
  "do",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "want",
  "wants",
  "need",
  "needs",
  "please",
  "customer",
  "patient",
  "pharmacist",
  "person",
  "ali",
  "که",
  "و",
  "یا",
  "ولی",
  "این",
  "آن",
  "را",
  "به",
  "از",
  "با",
  "در",
  "برای",
  "دارد",
  "داره",
  "دارند",
  "هست",
  "است",
  "بود",
  "می",
  "من",
  "یک",
  "هم",
  "نیز",
  "مشتری",
  "بیمار",
  "شخص",
]);

/**
 * Tokens that are too weak to prove relevance on their own (colours and
 * generic descriptors). A match on one of these never counts as an overlap.
 */
const WEAK_TOKENS = new Set([
  "red",
  "blue",
  "green",
  "yellow",
  "black",
  "white",
  "dark",
  "light",
  "bright",
  "mild",
  "soft",
  "strong",
  "large",
  "small",
  "new",
  "old",
  "good",
  "best",
  "daily",
  "extra",
  "plus",
  "قرمز",
  "آبی",
  "سبز",
  "زرد",
  "سیاه",
  "سفید",
  "تیره",
  "روشن",
]);

/** Domain vocabularies. Membership here makes a short token meaningful. */
export const DOMAINS = {
  eye: [
    "eye",
    "eyes",
    "ocular",
    "ophthalmic",
    "vision",
    "sight",
    "lens",
    "lenses",
    "eyelid",
    "cornea",
    "چشم",
    "چشمی",
    "چشمان",
    "بینایی",
    "قرنیه",
    "لنز",
  ],
  skin: [
    "skin",
    "skincare",
    "derm",
    "derma",
    "moisturizer",
    "moisturiser",
    "moisturizing",
    "moisturising",
    "hydrating",
    "sunscreen",
    "spf",
    "eczema",
    "acne",
    "psoriasis",
    "پوست",
    "مرطوب",
    "آبرسان",
  ],
  hair: ["hair", "scalp", "shampoo", "dandruff", "مو", "شامپو", "شوره"],
  supplement: [
    "supplement",
    "supplements",
    "vitamin",
    "vitamins",
    "multivitamin",
    "mineral",
    "minerals",
    "مکمل",
    "ویتامین",
    "مولتی ویتامین",
  ],
  // The catalog is largely Persian, so short English symptom keywords
  // ("cough", "headache") can never rely on token overlap alone. Each domain
  // carries the English and Persian words that actually appear in Darukade
  // product names and categories, so a source-ranked result can be justified.
  respiratory: [
    "cough",
    "coughs",
    "flu",
    "throat",
    "congestion",
    "respiratory",
    "سرفه",
    "سرماخوردگی",
    "گلودرد",
    "آنفولانزا",
    "عطسه",
    "آبریزش",
    "گلو",
    "تنفسی",
    "خلط",
  ],
  pain: [
    "headache",
    "migraine",
    "analgesic",
    "سردرد",
    "میگرن",
    "درد",
    "کمردرد",
  ],
  digestive: [
    "nausea",
    "vomiting",
    "diarrhea",
    "diarrhoea",
    "constipation",
    "bloating",
    "heartburn",
    "reflux",
    "stomach",
    "abdominal",
    "تهوع",
    "استفراغ",
    "اسهال",
    "یبوست",
    "نفخ",
    "معده",
    "گوارش",
  ],
  fever: ["fever", "temperature", "تب", "دماسنج"],
} as const;

export type DomainName = keyof typeof DOMAINS;

const DOMAIN_TERM_SET = new Set<string>();
for (const terms of Object.values(DOMAINS)) {
  for (const term of terms) DOMAIN_TERM_SET.add(term);
}

/** Symptoms that map a case into a domain (whole-word, lower-cased). */
const SYMPTOM_TO_DOMAIN: Array<{ terms: string[]; domain: DomainName }> = [
  {
    terms: [
      "eye",
      "eyes",
      "vision",
      "sight",
      "red eye",
      "red eyes",
      "eye pain",
      "blurred vision",
      "blurry vision",
      "ocular",
      "چشم",
      "بینایی",
      "تاری دید",
    ],
    domain: "eye",
  },
  {
    terms: [
      "skin",
      "rash",
      "acne",
      "eczema",
      "dry skin",
      "psoriasis",
      "itch",
      "itching",
      "dandruff",
      "پوست",
      "جوش",
      "خارش",
      "شوره",
    ],
    domain: "skin",
  },
  {
    terms: ["hair", "hair loss", "scalp", "مو", "ریزش مو"],
    domain: "hair",
  },
  {
    terms: [
      "cough",
      "cold",
      "flu",
      "sore throat",
      "throat",
      "runny nose",
      "sneezing",
      "congestion",
      "سرفه",
      "سرماخوردگی",
      "گلودرد",
      "آنفولانزا",
      "عطسه",
      "آبریزش بینی",
    ],
    domain: "respiratory",
  },
  {
    // Note: no bare "pain" here — "eye pain" must stay in the eye domain only.
    terms: [
      "headache",
      "migraine",
      "back pain",
      "joint pain",
      "muscle pain",
      "period pain",
      "cramp",
      "سردرد",
      "میگرن",
      "کمردرد",
      "درد مفاصل",
      "درد عضلانی",
    ],
    domain: "pain",
  },
  {
    terms: [
      "nausea",
      "vomiting",
      "diarrhea",
      "diarrhoea",
      "constipation",
      "bloating",
      "heartburn",
      "reflux",
      "stomach pain",
      "abdominal pain",
      "تهوع",
      "استفراغ",
      "اسهال",
      "یبوست",
      "نفخ",
      "درد معده",
      "درد شکم",
    ],
    domain: "digestive",
  },
  {
    terms: ["fever", "تب"],
    domain: "fever",
  },
];

const BEAUTY_SCOPE_TERMS = [
  ...DOMAINS.skin,
  ...DOMAINS.hair,
  "cream",
  "serum",
  "mask",
  "lotion",
  "gel",
  "toner",
  "cosmetic",
  "makeup",
  "lipstick",
  "کرم",
  "سرم",
  "ماسک",
  "لوسیون",
];

function textTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => normalizeIngredient(token))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function isMeaningful(token: string): boolean {
  if (WEAK_TOKENS.has(token)) return false;
  return token.length >= 4 || DOMAIN_TERM_SET.has(token);
}

/** Whole-word containment so "eyes" matches "eye" but "environ" does not. */
function tokenOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (shorter.length < 3 || longer.length < 4) return false;
  return longer.startsWith(shorter) || longer.endsWith(shorter);
}

/* ── Intent / scope inference ─────────────────────────────────── */

/** Derive the shopping intent from validated case facts. */
export function inferShoppingIntent(
  facts: CaseFacts,
  message: string,
): ShoppingIntent {
  // A symptom always wins: it must go through the safety assessment first.
  if (facts.symptoms.length > 0) return "medical_symptom";

  const text = [message, facts.goal ?? "", ...facts.productQueries]
    .join(" ")
    .toLowerCase();

  const hasSupplementTerm = DOMAINS.supplement.some((term) =>
    text.includes(term),
  );
  if (hasSupplementTerm) return "supplement";

  const hasBeautyTerm = [
    ...DOMAINS.skin,
    ...DOMAINS.hair,
    "cream",
    "serum",
    "mask",
    "lotion",
    "toner",
    "makeup",
    "کرم",
    "سرم",
    "ماسک",
  ].some((term) => text.includes(term));
  if (hasBeautyTerm) return "beauty";

  return "general";
}

/** Domain(s) suggested by the case symptoms, or null when none apply. */
export function symptomDomains(facts: CaseFacts): DomainName[] {
  const text = facts.symptoms.join(" ").toLowerCase();
  const domains: DomainName[] = [];
  for (const entry of SYMPTOM_TO_DOMAIN) {
    if (entry.terms.some((term) => text.includes(term))) {
      domains.push(entry.domain);
    }
  }
  return [...new Set(domains)];
}

/** Meaningful, normalized tokens drawn from the executed queries. */
export function meaningfulQueryTokens(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const query of queries) {
    for (const token of textTokens(query)) {
      if (!isMeaningful(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/**
 * Verified product facts: catalog category/breadcrumb data and structured
 * ingredients. These are the only source we treat as evidence of intended use.
 * Product names and keyword similarity are never sufficient on their own.
 */
function verifiedProductTokens(product: ProductDetails): string[] {
  return tokeniseParts([
    ...product.categories.map((category) => category.name),
    ...product.categories.flatMap((category) => category.breadcrumbs ?? []),
    ...product.ingredients.flatMap((ingredient) =>
      [
        ingredient.name,
        ingredient.name_en,
        ingredient.name_fa,
        ingredient.raw_name,
      ].filter((value): value is string => Boolean(value)),
    ),
  ]);
}

/** All searchable tokens, including name/brand — used only for scope hints. */
function productTokens(product: ProductDetails): string[] {
  return tokeniseParts([
    product.name,
    product.name_en ?? "",
    product.name_fa ?? "",
    product.brand ?? "",
    product.brand_fa ?? "",
    product.form ?? "",
    product.package_size ?? "",
    ...product.categories.map((category) => category.name),
    ...product.categories.flatMap((category) => category.breadcrumbs ?? []),
    ...product.ingredients.flatMap((ingredient) =>
      [
        ingredient.name,
        ingredient.name_en,
        ingredient.name_fa,
        ingredient.raw_name,
      ].filter((value): value is string => Boolean(value)),
    ),
  ]);
}

function tokeniseParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const token of textTokens(part)) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

function candidateScope(
  product: ProductDetails,
): "supplement" | "beauty" | null {
  const tokens = productTokens(product);
  if (
    tokens.some((token) =>
      (DOMAINS.supplement as readonly string[]).includes(token),
    )
  ) {
    return "supplement";
  }
  if (tokens.some((token) => BEAUTY_SCOPE_TERMS.includes(token))) {
    return "beauty";
  }
  return null;
}

/* ── Per-candidate evaluation ─────────────────────────────────── */

export interface RelevanceInput {
  product: ProductDetails;
  /** Meaningful tokens from the executed queries. */
  queryTokens: string[];
  /** Domains derived from the case symptoms (empty when none). */
  domains: DomainName[];
  intent: ShoppingIntent;
}

export function evaluateCandidateRelevance(
  input: RelevanceInput,
): RelevanceVerdict {
  const { product, queryTokens, domains, intent } = input;
  // Relevance must be justified by verified category/ingredient data. Product
  // names and keyword similarity alone are never evidence of intended use.
  const verifiedTokens = verifiedProductTokens(product);

  const matchedTokens = queryTokens.filter((queryToken) =>
    verifiedTokens.some((productToken) =>
      tokenOverlap(queryToken, productToken),
    ),
  );
  const hasOverlap = matchedTokens.length > 0;

  // For symptom shopping, a verified domain match also counts: an eye product
  // is plausibly relevant to an eye symptom even when the query words differ.
  const domainMatched =
    intent === "medical_symptom" &&
    domains.length > 0 &&
    domains.some((domain) =>
      DOMAINS[domain].some((term) => verifiedTokens.includes(term)),
    );

  const hasKnownIntendedUse =
    product.categories.length > 0 || product.ingredients.length > 0;

  const fail = (
    code: RelevanceDecisionCode,
    reason: string,
  ): RelevanceVerdict => ({
    productId: product.id,
    pass: false,
    code,
    reason,
    matchedTokens,
  });

  if (hasOverlap || domainMatched) {
    // Scope separation: a product valid for one shopping intent may be
    // irrelevant for another, even when words overlap.
    if (intent === "beauty" || intent === "supplement") {
      const scope = candidateScope(product);
      if (scope && scope !== intent) {
        return fail(
          "scope_mismatch",
          `Product belongs to the ${scope} scope, but the request is ${intent}.`,
        );
      }
    }
    return {
      productId: product.id,
      pass: true,
      code: null,
      reason:
        domainMatched && !hasOverlap
          ? `Relevant by symptom domain (${domains.join(", ")}).`
          : `Matches query terms: ${matchedTokens.join(", ")}.`,
      matchedTokens,
    };
  }

  if (!hasKnownIntendedUse) {
    return fail(
      "insufficient_product_data",
      "No category, ingredient or name overlap data justifies showing this product.",
    );
  }

  return fail(
    "intended_use_mismatch",
    "The product's verified category and intended use do not match the request.",
  );
}

/* ── Batch filter ─────────────────────────────────────────────── */

export interface RelevanceGateInput {
  products: ProductDetails[];
  queries: string[];
  facts: CaseFacts;
  intent: ShoppingIntent;
}

export interface RelevanceGateResult {
  kept: ProductDetails[];
  excluded: RelevanceVerdict[];
}

/** Apply the relevance gate to every candidate. */
export function filterCandidatesByRelevance(
  input: RelevanceGateInput,
): RelevanceGateResult {
  const queryTokens = meaningfulQueryTokens(input.queries);
  const domains = symptomDomains(input.facts);

  if (queryTokens.length === 0 && domains.length === 0) {
    // Nothing queryable and no symptom domain: no candidate can be justified.
    return {
      kept: [],
      excluded: input.products.map((product) => ({
        productId: product.id,
        pass: false,
        code: "no_queryable_intent" as RelevanceDecisionCode,
        reason: "No queryable intent: no product query or symptom domain.",
        matchedTokens: [],
      })),
    };
  }

  const kept: ProductDetails[] = [];
  const excluded: RelevanceVerdict[] = [];
  for (const product of input.products) {
    const verdict = evaluateCandidateRelevance({
      product,
      queryTokens,
      domains,
      intent: input.intent,
    });
    if (verdict.pass) kept.push(product);
    else excluded.push(verdict);
  }
  return { kept, excluded };
}
