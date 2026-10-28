/**
 * Curated Persian → English aliases for common terms.
 *
 * The public medical sources are almost entirely English, so a Persian query
 * needs a reliable English equivalent before it can reach MedlinePlus, PubMed,
 * DailyMed, RxNorm or PubChem. This table only contains mappings that are
 * stable and unambiguous. It is deliberately small: where no alias exists the
 * search falls back to the bounded translation service, and where that also
 * fails it says coverage is limited rather than guessing.
 */

import { normaliseHealthText } from "@/lib/safety/text";

const ALIASES: Record<string, string> = {
  // Symptoms / conditions
  سردرد: "headache",
  "درد سر": "headache",
  تب: "fever",
  سرفه: "cough",
  گلودرد: "sore throat",
  اسهال: "diarrhea",
  یبوست: "constipation",
  تهوع: "nausea",
  "درد معده": "stomach pain",
  "معده درد": "stomach pain",
  "درد شکم": "abdominal pain",
  "درد قفسه سینه": "chest pain",
  دیابت: "diabetes",
  "فشار خون": "high blood pressure",
  "فشار خون بالا": "high blood pressure",
  آسم: "asthma",
  آلرژی: "allergy",
  میگرن: "migraine",
  "کم خونی": "anemia",
  کمخونی: "anemia",
  اگزما: "eczema",
  پسوریازیس: "psoriasis",
  "رفلاکس معده": "acid reflux",
  سوزشسر: "heartburn",
  بیخوابی: "insomnia",
  "بی خوابی": "insomnia",
  اضطراب: "anxiety",
  افسردگی: "depression",
  // Drugs / ingredients
  آسپرین: "aspirin",
  استامینوفن: "acetaminophen",
  ایبوپروفن: "ibuprofen",
  "ویتامین دی": "vitamin d",
  "ویتامین د": "vitamin d",
  "ویتامین سی": "vitamin c",
  "ویتامین ب۱۲": "vitamin b12",
  "ویتامین ب12": "vitamin b12",
  امگا: "omega-3",
  "امگا ۳": "omega-3",
  "امگا 3": "omega-3",
  روی: "zinc",
  زینک: "zinc",
  آهن: "iron",
  منیزیم: "magnesium",
  کلسیم: "calcium",
  پتاسیم: "potassium",
  کراتین: "creatine",
  پروتئین: "protein",
  پروبیوتیک: "probiotic",
  "گلوکزامین": "glucosamine",
  ملاتونین: "melatonin",
};

/**
 * Resolve a Persian query to a known English term. Returns the English term,
 * or null when no curated alias matches.
 */
export function resolveAlias(query: string): string | null {
  const normalized = normaliseHealthText(query);
  if (!normalized) return null;

  const exact = ALIASES[normalized];
  if (exact) return exact;

  // Longest contained alias wins (so "فشار خون بالا" beats "فشار خون").
  let best: string | null = null;
  for (const [key, value] of Object.entries(ALIASES)) {
    if (normalized.includes(key) && (!best || key.length > best.length)) {
      best = value;
    }
  }
  return best;
}
