/**
 * Version-controlled deterministic red-flag ruleset.
 *
 * Every rule is data: id, level, matching terms (English + Persian), an
 * explanation and a next step. `assessSafety` in `./red-flags.ts` consumes this
 * table; nothing here performs IO, so the whole assessment is synchronous and
 * can never time out.
 *
 * Levels:
 *   emergency — potentially life- or vision-threatening; act immediately.
 *   urgent    — needs prompt professional assessment.
 *   caution   — advisory gates: more information or pharmacist assessment is
 *               needed before a product may be considered.
 *
 * ⚠ CLINICAL REVIEW: this criteria table was written from common triage
 * guidance and must be reviewed and signed off by a qualified clinician
 * (and periodically re-reviewed) before it is relied upon in production.
 * Never treat a `caution` or `routine` result as a diagnosis or as proof a
 * condition is harmless.
 */

export const SAFETY_RULESET_VERSION = "1.0.0";

export const SAFETY_RULESET_NOTE =
  "Deterministic red-flag criteria (v" +
  SAFETY_RULESET_VERSION +
  "). Pending review by a qualified clinician against current authoritative guidance.";

/** Severity level assigned to a rule. */
export type RuleLevel = "emergency" | "urgent" | "caution";

export interface RedFlagRule {
  /** Stable machine id (used in logs, tests and the assessment). */
  id: string;
  /** Human label used in explanations. */
  label: string;
  /** Rule severity level. */
  level: RuleLevel;
  /** Lower-cased substrings; any match fires the rule. */
  terms: string[];
  /**
   * Optional predicate for combination rules that need more than a substring
   * match. Receives the lower-cased haystack (message + case facts).
   */
  test?: (text: string) => boolean;
  explanation: string;
  nextStep: string;
}

/* ── Normalisation / detection helpers ───────────────────────── */

/** Normalise Persian/Arabic-Indic digits to ASCII so "۱۰/۱۰" is understood. */
export function normaliseDigits(text: string): string {
  return text.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Parse a pain score such as "10/10" or "10 out of 10"; null when absent. */
export function painScore(text: string): number | null {
  const match = normaliseDigits(text).match(
    /\b(\d{1,2})\s*(?:\/|out of)\s*10\b/,
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

export const EYE_TERMS =
  /\b(?:eye|eyes|ocular|eyeball|cornea|vision|sight)\b|چشم|چشمان|بینایی|قرنیه/i;
const PAIN_TERMS =
  /\b(?:pain|painful|hurts?|hurting|aching|ache|sore|soreness|discomfort)\b|درد|دردناک/i;
const SEVERE_TERMS =
  /\b(?:severe|severely|intense|intensely|extreme|extremely|unbearable|excruciating|agoni[sz]ing|intolerable|worst|killing me|really bad)\b|شدید|طاقت ?فرسا/i;
const EYE_RED_TERMS =
  /\b(?:red (?:eye|eyes)|eyes? (?:are|is|look|looks|became|becomes|turned) red|redness (?:in|of) (?:the )?(?:eye|eyes)|bloodshot)\b|قرمزی چشم|چشم(?:م|ش|ت)? قرمز|چشم قرمز شده/i;
const CONTACT_LENS_TERMS = /\b(?:contact lens(?:es)?|lenses)\b|لنز/i;
const VISION_CHANGE_TERMS =
  /\b(?:blurred|blurry|blur)\s+vision|vision\s+(?:is\s+)?(?:blurr\w+|gett\w+\s+worse|worse|chang\w+)|seeing\s+(?:halos|double)|double vision|تاری دید|تار شدن دید|دوبینی/i;
const LIGHT_SENSITIVITY_TERMS =
  /\b(?:light sensitivity|sensitive to light|photophobia)\b|حساسیت به نور/i;
const CHEMICAL_EYE_TERMS =
  /\b(?:chemical|acid|alkali|bleach|detergent)\b|مواد شیمیایی|اسید|باز|وایتکس/i;

/**
 * A pain score of 8/10 or higher, or extreme pain wording, is treated as
 * urgent regardless of the body part it is describing. Negated mentions
 * ("no severe pain") do not count.
 */
function isSeverePain(text: string): boolean {
  if (!PAIN_TERMS.test(text)) return false;
  const score = painScore(text);
  if (score !== null && score >= 8) return true;
  const severe = SEVERE_TERMS.exec(text);
  if (!severe) return false;
  const before = text.slice(Math.max(0, severe.index - 24), severe.index);
  return !/\b(?:no|not|none|never|without|ندارد|نیست|بدون)\b\s*$/.test(before);
}

const NEGATION_NEAR =
  /\b(?:no|not|none|never|without|doesn't|does\s+not|wears?\s+no|ندارد|نیست|بدون)\b/i;

/**
 * True when the pattern matches and is NOT negated in the ~16 characters
 * before the match (e.g. "no vision change" must not fire a vision rule).
 */
function unnegated(pattern: RegExp, text: string): boolean {
  const match = pattern.exec(text);
  if (!match) return false;
  const before = text.slice(Math.max(0, match.index - 16), match.index);
  return !NEGATION_NEAR.test(before);
}

/**
 * Emergency / urgent red flags. Order matters: rules are evaluated top-down
 * and the highest level wins, so emergency rules come first.
 */
export const EMERGENCY_AND_URGENT_RULES: RedFlagRule[] = [
  {
    id: "cardiac",
    label: "possible cardiac event",
    level: "emergency",
    terms: [
      "chest pain",
      "chest pressure",
      "chest tightness",
      "pain in my chest",
      "pain radiating to my arm",
      "pain to the arm",
      "pain to the jaw",
      "درد قفسه سینه",
      "درد سینه",
    ],
    explanation:
      "Chest pain or pressure can indicate a heart attack or another cardiac emergency.",
    nextStep:
      "Call emergency services now. Do not wait to see whether it settles.",
  },
  {
    id: "breathing",
    label: "breathing difficulty",
    level: "emergency",
    terms: [
      "difficulty breathing",
      "trouble breathing",
      "shortness of breath",
      "short of breath",
      "can't breathe",
      "cannot breathe",
      "wheezing",
      "تنگی نفس",
      "تنفس مشکل",
    ],
    explanation:
      "Difficulty breathing is an emergency symptom that needs immediate assessment.",
    nextStep: "Seek emergency care immediately.",
  },
  {
    id: "anaphylaxis",
    label: "possible severe allergic reaction",
    level: "emergency",
    terms: [
      "throat swelling",
      "swollen throat",
      "swelling of the throat",
      "swollen lips",
      "swollen tongue",
      "swelling of the face",
      "face swelling",
      "hives and trouble breathing",
      "anaphylaxis",
      "خفگی",
      "تورم گلو",
      "تورم لب",
    ],
    explanation:
      "Swelling of the face, lips, tongue or throat with breathing difficulty suggests a severe allergic reaction (anaphylaxis).",
    nextStep:
      "Use an adrenaline auto-injector if available and call emergency services now.",
  },
  {
    id: "stroke",
    label: "possible stroke",
    level: "emergency",
    terms: [
      "slurred speech",
      "can't speak",
      "face drooping",
      "facial droop",
      "weakness on one side",
      "numbness on one side",
      "sudden confusion",
      "sudden vision loss",
      "loss of vision",
      "لکنت",
      "بی حسی یک طرفه",
      "فلج",
    ],
    explanation:
      "Sudden weakness, numbness, speech difficulty or vision loss can indicate a stroke.",
    nextStep:
      "Call emergency services immediately — stroke treatment is time-critical.",
  },
  {
    id: "severe-headache",
    label: "sudden severe headache",
    level: "emergency",
    terms: [
      "worst headache",
      "worst headache of my life",
      "sudden severe headache",
      "thunderclap headache",
      "headache with stiff neck",
      "سردرد شدید",
    ],
    explanation:
      "A sudden, severe or 'worst ever' headache can signal bleeding around the brain or meningitis.",
    nextStep: "Go to an emergency department now.",
  },
  {
    id: "bleeding",
    label: "possible internal bleeding",
    level: "emergency",
    terms: [
      "vomiting blood",
      "vomited blood",
      "coughing blood",
      "coughing up blood",
      "blood in stool",
      "bloody stool",
      "black tarry stool",
      "black stool",
      "uncontrolled bleeding",
      "won't stop bleeding",
      "خون استفراغ",
      "خون در مدفوع",
      "خونریزی",
    ],
    explanation:
      "Vomiting or coughing blood, or black/bloody stools, can indicate significant bleeding.",
    nextStep: "Go to an emergency department immediately.",
  },
  {
    id: "neurological",
    label: "loss of consciousness or seizure",
    level: "emergency",
    terms: [
      "seizure",
      "convulsion",
      "fainted",
      "passed out",
      "unconscious",
      "loss of consciousness",
      "تشنج",
      "غش",
      "بیهوش",
    ],
    explanation:
      "A seizure, fainting or loss of consciousness needs urgent medical evaluation.",
    nextStep: "Call emergency services or go to an emergency department.",
  },
  {
    id: "meningitis",
    label: "fever with neck stiffness",
    level: "emergency",
    terms: [
      "stiff neck and fever",
      "fever and stiff neck",
      "fever with rash",
      "neck stiffness",
      "خشکی گردن",
    ],
    explanation:
      "Fever with neck stiffness or a non-blanching rash can indicate meningitis or another serious infection.",
    nextStep: "Seek emergency care immediately.",
  },
  {
    id: "overdose",
    label: "possible overdose or poisoning",
    level: "emergency",
    terms: [
      "overdose",
      "took too many",
      "too many pills",
      "poisoning",
      "swallowed bleach",
      "مسمومیت",
      "مصرف بیش از حد",
    ],
    explanation:
      "A suspected overdose or poisoning is a time-critical emergency.",
    nextStep:
      "Call emergency services or a poison control centre immediately and keep the packaging.",
  },
  {
    id: "self-harm",
    label: "risk of self-harm",
    level: "emergency",
    terms: [
      "suicidal",
      "suicide",
      "want to die",
      "end my life",
      "self harm",
      "خودکشی",
    ],
    explanation:
      "Thoughts of self-harm require immediate, compassionate professional support.",
    nextStep:
      "Contact emergency services or a crisis helpline now and stay with the person.",
  },
  {
    id: "pregnancy-emergency",
    label: "pregnancy warning sign",
    level: "emergency",
    terms: [
      "pregnant and bleeding",
      "pregnancy bleeding",
      "no fetal movement",
      "no baby movement",
      "severe pain during pregnancy",
      "خونریزی بارداری",
    ],
    explanation:
      "Bleeding, severe pain or reduced fetal movement in pregnancy needs urgent obstetric review.",
    nextStep: "Contact the maternity unit or emergency services immediately.",
  },
  {
    id: "eye-chemical-exposure",
    label: "chemical exposure to the eye",
    level: "emergency",
    terms: [
      "chemical in my eye",
      "chemical in the eye",
      "chemical splashed",
      "chemical burn",
      "acid in my eye",
      "bleach in my eye",
      "سوختگی شیمیایی چشم",
      "مواد شیمیایی داخل چشم",
      "اسید داخل چشم",
    ],
    test: (text) => EYE_TERMS.test(text) && unnegated(CHEMICAL_EYE_TERMS, text),
    explanation:
      "A chemical splash to the eye is a sight-threatening emergency.",
    nextStep:
      "Rinse the eye immediately with clean running water for at least 15 minutes, then go to emergency care straight away. Do not wait or apply any drops first.",
  },
  {
    id: "eye-trauma",
    label: "eye injury or foreign body",
    level: "urgent",
    terms: [
      "eye injury",
      "injured my eye",
      "eye trauma",
      "hit in the eye",
      "something in my eye",
      "object in my eye",
      "foreign body in my eye",
      "can't open my eye",
      "cannot open my eye",
      "آسیب چشم",
      "ضربه به چشم",
    ],
    explanation:
      "An eye injury or an embedded foreign body can threaten sight and needs examination.",
    nextStep:
      "Arrange same-day eye assessment. Do not rub the eye or try to remove an embedded object.",
  },
  {
    id: "eye-vision-threat",
    label: "eye pain with vision change or light sensitivity",
    level: "urgent",
    terms: [
      "sudden eye pain",
      "severe eye pain",
      "eye pain is severe",
      "درد شدید چشم",
    ],
    test: (text) =>
      EYE_TERMS.test(text) &&
      (unnegated(VISION_CHANGE_TERMS, text) ||
        unnegated(LIGHT_SENSITIVITY_TERMS, text) ||
        isSeverePain(text)),
    explanation:
      "Eye pain together with a change in vision or sensitivity to light can indicate a sight-threatening condition such as acute glaucoma or keratitis.",
    nextStep:
      "Arrange same-day eye assessment. Do not apply drops or ointments before the eye is examined.",
  },
  {
    id: "eye-contact-lens-redness",
    label: "red eye with contact lens use",
    level: "urgent",
    terms: [],
    test: (text) =>
      EYE_RED_TERMS.test(text) && unnegated(CONTACT_LENS_TERMS, text),
    explanation:
      "A red or painful eye in a contact-lens wearer can indicate a serious corneal infection.",
    nextStep:
      "Remove the contact lenses now and do not wear them again until the eye has been assessed. If the eye does not settle quickly, arrange same-day eye assessment.",
  },
  {
    id: "abdominal-emergency",
    label: "severe abdominal pain",
    level: "urgent",
    terms: [
      "severe abdominal pain",
      "severe stomach pain",
      "excruciating stomach pain",
      "rigid abdomen",
      "stomach is hard",
      "درد شدید شکم",
      "درد شدید معده",
    ],
    explanation:
      "Severe or rigid abdominal pain can indicate a surgical emergency such as appendicitis or perforation.",
    nextStep: "Seek urgent medical care today.",
  },
  {
    id: "infant-fever",
    label: "young infant with fever",
    level: "urgent",
    terms: [
      "newborn fever",
      "baby fever",
      "infant fever",
      "3 week old with fever",
      "2 month old with fever",
      "تب نوزاد",
    ],
    explanation:
      "Fever in a very young infant (under about 3 months) requires urgent paediatric assessment.",
    nextStep: "Have the infant seen urgently today.",
  },
  {
    id: "severe-pain",
    label: "very severe pain",
    level: "urgent",
    terms: [],
    test: (text) => isSeverePain(text),
    explanation:
      "Pain rated 8/10 or higher, or described as unbearable or excruciating, needs urgent assessment.",
    nextStep:
      "Arrange urgent medical assessment today rather than relying on over-the-counter products alone.",
  },
];

/**
 * Advisory (caution) rules. These do not escalate on their own — they gate
 * product recommendations and ask focused questions so the missing
 * information can be collected safely.
 */
export const CAUTION_RULES: RedFlagRule[] = [
  {
    id: "eye-redness-unresolved",
    label: "red eyes without enough information",
    level: "caution",
    terms: ["red eye", "red eyes", "قرمزی چشم"],
    test: (text) => EYE_RED_TERMS.test(text),
    explanation:
      "Red eyes have many possible causes. Without knowing about pain, vision changes, injury, chemical exposure or contact-lens use, no product should be suggested.",
    nextStep:
      "Ask about pain, vision changes, light sensitivity, injury or chemical exposure, and contact-lens use before considering any product.",
  },
  {
    id: "medication-combination-question",
    label: "possible medicine interaction",
    level: "caution",
    terms: [
      "interaction",
      "interactions",
      "interact",
      "drug interaction",
      "safe with",
      "safely with",
      "safe to take",
      "safe to use",
      "conflict with",
      "mix with",
      "تداخل دارویی",
      "تداخل",
    ],
    test: (text) =>
      /\b(?:uses?|takes?|on)\b[^.!?\n]{0,80}\b(?:is|are)\b[^.!?\n]{0,50}\b(?:good|ok|okay|safe|fine|alright)\b/i.test(
        text,
      ) &&
      /\b(?:supplement|pill|pills|med|meds|medicine|medication|tablet|capsule|syrup|مکمل|قرص|دارو)\b/i.test(
        text,
      ),
    explanation:
      "The customer is taking medicines and the pharmacist is asking whether another product can be combined with them. Drug/supplement interactions must be checked against a reliable reference before anything is suggested.",
    nextStep:
      "Check the customer's medicines against the product for interactions before suggesting it.",
  },
];

/** Focused questions attached to the eye-redness caution rule. */
export const EYE_REDNESS_FOLLOW_UPS: string[] = [
  "Is the eye painful, and how severe is the pain?",
  "Has the vision changed at all (blurring, halos, loss of sight)?",
  "Is the eye sensitive to light?",
  "Was there any injury, or did anything (including a chemical) get into the eye?",
  "Does the customer wear contact lenses?",
];

/** Focused questions attached to the medicine-interaction caution rule. */
export const MEDICATION_INTERACTION_FOLLOW_UPS: string[] = [
  "Have the customer's medicines and this product been checked for interactions against a reliable reference?",
];

/** Per-rule follow-up questions used by the assessment engine. */
export const CAUTION_FOLLOW_UPS: Record<string, string[]> = {
  "eye-redness-unresolved": EYE_REDNESS_FOLLOW_UPS,
  "medication-combination-question": MEDICATION_INTERACTION_FOLLOW_UPS,
};

/* ── Eye-protocol resolution ─────────────────────────────────── */

/**
 * Negation patterns covering the eye-redness follow-ups. When the pharmacist
 * answers at least three of the five protocol questions with a negation (and
 * nothing escalated), the red-eye concern is considered resolved and ordinary
 * product evaluation may proceed within scope.
 */
const EYE_RESOLUTION_PATTERNS: RegExp[] = [
  /\bno(?:t)?\s+(?:any\s+)?(?:eye\s+)?pain\b|\bpainless\b|بدون درد|درد ندارد/i,
  /\bvision\s+(?:is\s+)?(?:fine|ok|okay|normal|clear|good)\b|\bno\s+(?:vision|visual)\s+(?:change|changes|loss|blur\w*)\b|دید(?:ش)?\s+(?:خوب|عادی|طبیعی|سالم)\s*است|تغییری در دید ندارد/i,
  /\bno(?:t)?\s+(?:light\s+sensitivity|sensitive\s+to\s+light)\b|حساسیت به نور ندارد/i,
  /\bno\s+(?:injury|trauma|chemical)\b|\bnothing\s+(?:got|went)\s+in(?:to)?\s+(?:the\s+)?eye\b|آسیب ندیده|ضربه ندیده/i,
  /\b(?:no|not|never|doesn't|does\s+not|wears?\s+no)\b[^.!?\n]{0,20}\b(?:contact\s+lens(?:es)?|lenses)\b|\bwithout\s+(?:contact\s+)?lenses\b|لنز ندارد|لنز نمی ?زند/i,
];

/** True when the current message answers the eye protocol with negations. */
export function eyeRednessResolved(text: string): boolean {
  return (
    EYE_RESOLUTION_PATTERNS.filter((pattern) => pattern.test(text)).length >= 3
  );
}

/** Ids of rules whose questions must be asked before any product is shown. */
export const CAUTION_RULE_IDS = new Set(CAUTION_RULES.map((rule) => rule.id));
