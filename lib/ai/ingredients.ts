/**
 * Ingredient normalization for allergy/compatibility matching.
 *
 * The database stores a canonical English name per ingredient plus a Persian
 * name and free-form aliases. Customers name ingredients colloquially and in
 * either language ("ginger", "ginger root", "Zingiber officinale", "زنجبیل"),
 * so we map known synonyms onto a single canonical key before comparing.
 *
 * This is intentionally conservative: it is a *hard* safety constraint, so a
 * miss (unknown) is surfaced to the user rather than silently treated as safe.
 */

const SYNONYM_GROUPS: string[][] = [
  [
    "ginger",
    "ginger root",
    "ginger extract",
    "ginger powder",
    "zingiber officinale",
    "زنجبیل",
    "زنجبيل",
  ],
  ["aspirin", "acetylsalicylic acid", "asa", "آسپرین", "آسپیرین"],
  ["ibuprofen", "advil", "motrin", "brufen", "ایبوپروفن", "بروفن"],
  ["naproxen", "naprosyn", "نپروکسن"],
  ["paracetamol", "acetaminophen", "استامینوفن", "استامينوفن", "پاراستامول"],
  ["penicillin", "penicillins", "پنی سیلین", "پنیسلین"],
  ["amoxicillin", "آموکسی سیلین", "آموکسی‌سیلین"],
  ["cephalosporin", "cephalosporins", "سفالوسپورین"],
  ["sulfa", "sulfonamide", "sulfonamides", "sulfite", "sulfites", "سولفا", "سولفیت"],
  ["codeine", "کدئین"],
  ["lactose", "لاکتوز"],
  ["gluten", "گلوتن"],
  ["caffeine", "کافئین", "کافيين"],
  ["shellfish", "crustacean", "crustaceans", "صدف", "میگو"],
  ["peanut", "peanuts", "arachis", "بادام زمینی", "بادام‌زمینی"],
  ["soy", "soya", "soybean", "سویا"],
  ["milk", "dairy", "شیر", "لبنیات"],
  ["egg", "eggs", "albumin", "تخم مرغ", "تخم‌مرغ"],
  ["wheat", "گندم"],
  ["tree nut", "tree nuts", "nuts", "almond", "آجیل", "بادام"],
  ["sesame", "کنجد"],
  ["fish", "ماهی"],
  ["iodine", "ید"],
  ["iron", "ferrous", "ferric", "آهن"],
  ["vitamin c", "ascorbic acid", "ویتامین سی"],
  ["folic acid", "folate", "اسید فولیک"],
  ["chondroitin", "کندرویتین"],
  ["glucosamine", "گلوکزامین"],
  ["collagen", "کلاژن"],
  ["bee pollen", "propolis", "گرده گل", "بره موم"],
];

/**
 * Fold Arabic presentation variants onto their Persian counterparts so that the
 * same word typed with an Arabic keyboard still matches the stored spelling
 * (e.g. "آويشن" → "آویشن", "كاپتيس" → "کاپتیس"). Database ingredient names mix
 * the two scripts freely, so this is required for reliable matching.
 */
const ARABIC_VARIANTS: Record<string, string> = {
  "\u064a": "\u06cc", // ي → ی
  "\u0649": "\u06cc", // ى → ی
  "\u0643": "\u06a9", // ك → ک
  "\u0629": "\u0647", // ة → ه
  "\u0623": "\u0627", // أ → ا
  "\u0625": "\u0627", // إ → ا
  "\u0622": "\u0627", // آ → ا
  "\u0624": "\u0648", // ؤ → و
};

/** Normalize a raw ingredient/allergen string for comparison. */
export function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u200b\u200c\u200e\u200f]/g, "") // strip ZWSP / ZWNJ / bidi marks
    .replace(/[\u064b-\u0652\u0640]/g, "") // strip Arabic diacritics + tatweel
    .replace(/[\u064a\u0649\u0643\u0629\u0623\u0625\u0622\u0624]/g, (char) =>
      ARABIC_VARIANTS[char] ?? char,
    )
    .replace(/[._(),/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const synonymIndex = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const key = group[0];
  for (const term of group) {
    synonymIndex.set(normalizeIngredient(term), key);
  }
}

/** Resolve a name to its canonical synonym-group key (or its normalized form). */
export function canonicalIngredientKey(name: string): string {
  const normalized = normalizeIngredient(name);
  return synonymIndex.get(normalized) ?? normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word containment so "iron" matches "iron oxide" but not "environ". */
function containsWholeWord(haystack: string, needle: string): boolean {
  if (needle.length < 3) return false;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}([^\\p{L}\\p{N}]|$)`, "u");
  return pattern.test(haystack);
}

/**
 * True when any candidate ingredient name refers to the allergen.
 *
 * Order of checks: canonical-key equality (handles cross-language synonyms),
 * exact normalized equality, then whole-word containment.
 */
export function ingredientMatchesAllergen(
  allergen: string,
  candidates: string[],
): boolean {
  const allergenNorm = normalizeIngredient(allergen);
  if (!allergenNorm) return false;
  const allergenKey = canonicalIngredientKey(allergen);

  return candidates.some((candidate) => {
    const candidateNorm = normalizeIngredient(candidate);
    if (!candidateNorm) return false;
    if (canonicalIngredientKey(candidate) === allergenKey) return true;
    if (candidateNorm === allergenNorm) return true;
    return (
      containsWholeWord(candidateNorm, allergenNorm) ||
      containsWholeWord(allergenNorm, candidateNorm)
    );
  });
}
