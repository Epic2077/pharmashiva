/**
 * Deterministic chat icon picker.
 *
 * A new chat gets a lucide icon slug derived from the first message. This runs
 * with no model call and no React dependency, so it is safe on the server and in
 * the browser. The slug → component map lives in `components/history/HistoryCard`.
 */

/** Every slug this picker can return. Keep in sync with `ICON_BY_SLUG`. */
export const CHAT_ICON_SLUGS = [
  "general",
  "head",
  "eye",
  "ear",
  "stomach",
  "back",
  "joint",
  "heart",
  "skin",
  "cold",
  "lung",
  "allergy",
  "sleep",
  "baby",
  "infection",
  "medicine",
  "mind",
] as const;

export type ChatIconSlug = (typeof CHAT_ICON_SLUGS)[number];

export const DEFAULT_CHAT_ICON: ChatIconSlug = "general";

/** First match wins, so put more specific complaints above broader ones. */
const ICON_RULES: ReadonlyArray<{ slug: ChatIconSlug; keywords: string[] }> = [
  {
    slug: "head",
    keywords: ["headache", "migraine", "head pain", "سردرد", "میگرن", "سر درد"],
  },
  {
    slug: "eye",
    keywords: [
      "eye",
      "conjunctiv",
      "vision",
      "blurry",
      "چشم",
      "بینایی",
      "قرمزی چشم",
      "تاری دید",
    ],
  },
  {
    slug: "ear",
    keywords: ["ear", "hearing", "tinnitus", "گوش", "شنوایی", "وزوز"],
  },
  {
    slug: "cold",
    keywords: [
      "fever",
      "cold",
      "flu",
      "sore throat",
      "runny nose",
      "تب",
      "سرماخوردگی",
      "گلودرد",
      "آنفولانزا",
      "آبریزش",
    ],
  },
  {
    slug: "lung",
    keywords: [
      "cough",
      "breath",
      "asthma",
      "wheez",
      "shortness of breath",
      "سرفه",
      "تنفس",
      "آسم",
      "ریه",
      "نفس",
    ],
  },
  {
    slug: "stomach",
    keywords: [
      "stomach",
      "nausea",
      "vomit",
      "digest",
      "diarrhea",
      "constipat",
      "abdom",
      "reflux",
      "heartburn",
      "gut",
      "معده",
      "دلدرد",
      "دل درد",
      "اسهال",
      "یبوست",
      "تهوع",
      "استفراغ",
      "گوارش",
      "ریفلاکس",
      "سوزش سر دل",
    ],
  },
  {
    slug: "back",
    keywords: [
      "back pain",
      "lower back",
      "backache",
      "spine",
      "کمر",
      "کمردرد",
      "کمر درد",
      "ستون فقرات",
    ],
  },
  {
    slug: "joint",
    keywords: [
      "joint",
      "knee",
      "shoulder",
      "ankle",
      "wrist",
      "arthritis",
      "muscle",
      "sprain",
      "مفصل",
      "زانو",
      "شانه",
      "مچ",
      "آرتروز",
      "عضله",
      "گرفتگی",
      "پیچ خوردگی",
    ],
  },
  {
    slug: "heart",
    keywords: [
      "heart",
      "chest pain",
      "blood pressure",
      "palpitat",
      "cholesterol",
      "قلب",
      "فشار خون",
      "درد قفسه سینه",
      "تپش",
      "کلسترول",
    ],
  },
  {
    slug: "skin",
    keywords: [
      "skin",
      "rash",
      "itch",
      "acne",
      "eczema",
      "wound",
      "پوست",
      "خارش",
      "جوش",
      "اگزما",
      "زخم",
      "کهیر",
    ],
  },
  {
    slug: "allergy",
    keywords: ["allerg", "hives", "anaphyla", "حساسیت", "آلرژی"],
  },
  {
    slug: "sleep",
    keywords: ["sleep", "insomnia", "خواب", "بیخوابی", "بی خوابی"],
  },
  {
    slug: "baby",
    keywords: [
      "baby",
      "infant",
      "newborn",
      "toddler",
      "pediatric",
      "child",
      "نوزاد",
      "شیرخوار",
      "کودک",
      "اطفال",
    ],
  },
  {
    slug: "infection",
    keywords: [
      "infection",
      "antibiotic",
      "virus",
      "bacteri",
      "fungal",
      "عفونت",
      "ویروس",
      "باکتری",
      "آنتی بیوتیک",
    ],
  },
  {
    slug: "mind",
    keywords: [
      "anxiety",
      "depress",
      "stress",
      "mood",
      "panic",
      "افسردگی",
      "اضطراب",
      "استرس",
      "روان",
      "پنیک",
    ],
  },
  {
    slug: "medicine",
    keywords: [
      "dosage",
      "dose",
      "side effect",
      "interaction",
      "medication",
      "prescription",
      "دارو",
      "دوز",
      "عوارض",
      "تداخل",
      "مصرف",
      "نسخه",
    ],
  },
];

/** Fold common Arabic/Persian letter variants so matching is script-agnostic. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ");
}

/** Pick an icon slug for a chat from its first message. */
export function pickChatIcon(text: string): ChatIconSlug {
  const haystack = normalize(text);
  if (!haystack) return DEFAULT_CHAT_ICON;

  for (const rule of ICON_RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(normalize(keyword))) return rule.slug;
    }
  }
  return DEFAULT_CHAT_ICON;
}

/** Narrow an arbitrary string (e.g. from the DB) to a known slug. */
export function coerceChatIcon(value: string | null | undefined): ChatIconSlug {
  if (value && (CHAT_ICON_SLUGS as readonly string[]).includes(value)) {
    return value as ChatIconSlug;
  }
  return DEFAULT_CHAT_ICON;
}
