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
 *   caution   — advisory gates: more information is needed before a product
 *               may be considered.
 *
 * ⚠ CLINICAL REVIEW: this criteria table was written from common triage
 * guidance and must be reviewed and signed off by a qualified clinician
 * (and periodically re-reviewed) before it is relied upon in production.
 * Never treat a `caution` or `routine` result as a diagnosis or as proof a
 * condition is harmless.
 */

import {
  normaliseDigits,
  normaliseHealthText,
  patternIsDenied,
  patternIsHypothetical,
  unnegatedPattern,
} from "./text.ts";

export { hasUnnegatedTerm, normaliseDigits } from "./text.ts";

export const SAFETY_RULESET_VERSION = "1.2.0";

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
  /** Optional focused questions to ask after displaying the safety next step. */
  followUpQuestions?: string[];
}

/* ── Normalisation / detection helpers ───────────────────────── */

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
export const EYE_RED_TERMS =
  /\b(?:red (?:eye|eyes)|eyes? (?:are|is|look|looks|became|becomes|turned) red|eyes? red|redness (?:in|of) (?:the )?(?:eye|eyes)|redness in (?:my|his|her|their|the patient's|the patients') eyes?|bloodshot)\b|قرمزی چشم|چشم(?:م|ش|ت|ام|اش|هاش|هاشون)? قرمز|چشم قرمز شده|چشماش قرمزه|چشمهاش قرمزه|چشمام قرمزه/i;
/**
 * Eye pain or discomfort (without a red-flag feature). This is a symptom that
 * needs the eye protocol questions, not a routine shopping request.
 */
export const EYE_PAIN_TERMS =
  /\b(?:eye|eyes|ocular)\b[^.!?\n]{0,24}\b(?:pain|painful|hurt|hurts|hurting|ache|aches|aching|sore|soreness|discomfort|irritat\w*)\b|\b(?:pain|painful|hurt|hurts|hurting|ache|aches|aching|sore|soreness|discomfort|irritat\w*)\b[^.!?\n]{0,24}\b(?:eye|eyes|ocular)\b|درد چشم|چشم درد|چشم(?:م|ش|ت|ام|اش|هاش)? درد|سوزش چشم|خارش چشم|چشم(?:م|ش|ت|ام|اش|هاش)? (?:درد می\s?کند|درد می\s?کنه|می\s?سوزد)/i;
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
  // Hypothetical examples ("if I had severe pain") are not findings.
  if (patternIsHypothetical(PAIN_TERMS, text)) return false;
  const score = painScore(text);
  if (score !== null && score >= 8) return true;
  // Every severe occurrence must be unnegated.
  if (!unnegated(SEVERE_TERMS, text)) return false;
  const severe = SEVERE_TERMS.exec(text);
  if (!severe) return false;
  const before = text.slice(Math.max(0, severe.index - 24), severe.index);
  return !/\b(?:no|not|none|never|without|ندارد|نیست|بدون)\b\s*$/.test(before);
}

/**
 * True when the pattern matches and at least one occurrence is NOT locally
 * negated (e.g. "no vision change" must not fire a vision rule). The
 * clause-scoped implementation lives in `./text.ts`.
 */
function unnegated(pattern: RegExp, text: string): boolean {
  return unnegatedPattern(pattern, text);
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
    followUpQuestions: [
      "Did the vision change start suddenly, and is it getting worse?",
      "Is there significant eye pain or sensitivity to light?",
      "Was there an injury or chemical exposure, and does the customer wear contact lenses?",
    ],
  },
  {
    id: "eye-contact-lens-redness",
    label: "red eye with contact lens use",
    level: "urgent",
    terms: [],
    test: (text) =>
      unnegated(EYE_RED_TERMS, text) && unnegated(CONTACT_LENS_TERMS, text),
    explanation:
      "A red or painful eye in a contact-lens wearer can indicate a serious corneal infection.",
    nextStep:
      "Remove the contact lenses now and do not wear them again until the eye has been assessed. If the eye does not settle quickly, arrange same-day eye assessment.",
    followUpQuestions: [
      "Is there eye pain, light sensitivity, or any change in vision?",
      "When did the redness start, and is it getting worse?",
      "Was there any injury or chemical exposure?",
    ],
  },
  {
    id: "skin-infection",
    label: "possible spreading skin infection",
    level: "urgent",
    terms: [
      "spreading redness",
      "red streaks",
      "red streak from the wound",
      "infected wound",
      "wound with pus",
      "cellulitis",
      "قرمزی گسترده",
      "خطوط قرمز",
      "چرک",
    ],
    explanation:
      "Spreading redness, red streaks or pus from a wound can indicate a serious skin infection that needs prompt assessment.",
    nextStep:
      "Arrange prompt medical assessment today. Do not apply cosmetic products over the area.",
    followUpQuestions: [
      "Is the redness spreading, and is there fever, warmth or pus?",
      "When did it start, and was there a wound, bite or injury?",
    ],
  },
  {
    id: "burns",
    label: "significant burn",
    level: "urgent",
    terms: [
      "severe burn",
      "deep burn",
      "third degree burn",
      "chemical burn",
      "burn over a large area",
      "سوختگی شدید",
      "سوختگی درجه سه",
    ],
    explanation:
      "A deep, extensive or chemical burn needs prompt professional wound care and infection assessment.",
    nextStep:
      "Cool the burn with clean running water and seek same-day medical assessment. Do not apply ointments or cosmetics before review.",
    followUpQuestions: [
      "How large is the burn, and what caused it?",
      "Is there blistering, white/charred skin, or numbness?",
    ],
  },
  {
    id: "adverse-drug-reaction",
    label: "possible adverse drug reaction",
    level: "urgent",
    terms: [],
    test: (text) =>
      unnegated(
        /\b(?:adverse|bad)\s+(?:reaction|effect)\b|\breaction to (?:the |my |her |his )?(?:medicine|medication|tablet|drug|supplement)\b|\brash after taking\b|واکنش (?:دارویی|به دارو)|حساسیت دارویی/i,
        text,
      ),
    explanation:
      "A reaction after starting a medicine or supplement needs prompt review before another product is suggested.",
    nextStep:
      "Stop the suspected product and arrange prompt medical or pharmacist review. Seek emergency care if there is facial/throat swelling or breathing difficulty.",
    followUpQuestions: [
      "Which medicine or supplement was started, when, and what reaction occurred?",
      "Is there any facial swelling, breathing difficulty, blistering or fever?",
    ],
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
 * Advisory (caution) rules. These request focused questions when key information
 * is missing. Product-card visibility is separate from clinical clearance;
 * symptom-directed suitability must still be checked independently.
 */
export const CAUTION_RULES: RedFlagRule[] = [
  {
    id: "eye-redness-unresolved",
    label: "red eyes without enough information",
    level: "caution",
    terms: ["red eye", "red eyes", "قرمزی چشم"],
    test: (text) => unnegated(EYE_RED_TERMS, text),
    explanation:
      "Red eyes have many possible causes. Without knowing about pain, vision changes, injury, chemical exposure or contact-lens use, no product should be suggested.",
    nextStep:
      "Ask about pain, vision changes, light sensitivity, injury or chemical exposure, and contact-lens use before considering any product.",
  },
  {
    id: "eye-pain-unresolved",
    label: "eye pain or discomfort without enough information",
    level: "caution",
    terms: [
      "eye pain",
      "eye hurts",
      "eye hurting",
      "eyes hurt",
      "eyes hurting",
      "painful eye",
      "sore eye",
      "eye discomfort",
      "eye irritation",
      "درد چشم",
      "چشم درد",
    ],
    test: (text) => unnegated(EYE_PAIN_TERMS, text),
    explanation:
      "Eye pain or discomfort has many possible causes. Without knowing about pain severity, vision changes, injury, chemical exposure or contact-lens use, no product should be suggested.",
    nextStep:
      "Ask about pain severity, vision changes, light sensitivity, injury or chemical exposure, and contact-lens use before considering any product.",
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

/* ── Eye protocol (tracked answers) ──────────────────────────── */

export type ProtocolAnswerStatus = "present" | "denied" | "unknown";

export interface EyeProtocolQuestion {
  id: string;
  question: string;
  /** Pattern that detects a positive answer to this question. */
  present: RegExp;
  /** Pattern that detects an explicit negative ("no pain", "vision is fine"). */
  denied: RegExp;
}

/**
 * The eye-redness protocol. Each concern is tracked independently across the
 * whole consultation; the latest answer wins, and a concern is only resolved
 * when every protocol question has an answer and none is positive.
 */
export const EYE_PROTOCOL: EyeProtocolQuestion[] = [
  {
    id: "pain",
    question: "Is the eye painful, and how severe is the pain?",
    present: EYE_PAIN_TERMS,
    denied:
      /\bno(?:t)?\s+(?:any\s+)?(?:eye\s+)?pain\b|\bpainless\b|\beyes?\s+(?:do\s+not|don'?t|does\s+not|doesn'?t)\s+hurt\b|\beyes?\s+(?:are\s+)?(?:fine|not\s+sore)\b|بدون درد|درد ندارد|درد نمی\s?کند/i,
  },
  {
    id: "vision",
    question: "Has the vision changed at all (blurring, halos, loss of sight)?",
    present: VISION_CHANGE_TERMS,
    denied:
      /\bvision\s+(?:is\s+)?(?:fine|ok|okay|normal|clear|good)\b|\bno\s+(?:vision|visual)\s+(?:change|changes|loss|blur\w*)\b|\b(?:vision|sight)\s+(?:is\s+)?(?:unchanged|normal)\b|دید(?:ش)?\s+(?:خوب|عادی|طبیعی|سالم)\s*است|تغییری در دید ندارد/i,
  },
  {
    id: "light",
    question: "Is the eye sensitive to light?",
    present: LIGHT_SENSITIVITY_TERMS,
    denied:
      /\bno(?:t)?\s+(?:any\s+)?(?:light\s+sensitivity|sensitive(?:ness)?\s+to\s+light)\b|\blight\s+(?:doesn'?t|does\s+not)\s+bother\b|حساسیت به نور ندارد|نور اذیتش نمی/i,
  },
  {
    id: "injury",
    question:
      "Was there any injury, or did anything (including a chemical) get into the eye?",
    present:
      /\b(?:eye injury|injured my eye|eye trauma|hit in the eye|something (?:got )?in my eye|object in my eye|foreign body in my eye|chemical[^.!?\n]{0,24}eye|eye[^.!?\n]{0,24}chemical)\b|آسیب چشم|ضربه به چشم|چیزی[^.!?\n]{0,16}چشم|مواد شیمیایی[^.!?\n]{0,16}چشم/i,
    denied:
      /\bno\s+(?:injury|trauma|chemical)\b|\bnothing\s+(?:got|went|went\s+into|got\s+into)\s+(?:the\s+)?eye\b|\bnothing\s+(?:got|went)\s+in(?:to)?\s+(?:the\s+)?eye\b|آسیب ندیده|ضربه ندیده|چیزی نرفته|مواد شیمیایی نبوده/i,
  },
  {
    id: "lenses",
    question: "Does the customer wear contact lenses?",
    present: CONTACT_LENS_TERMS,
    denied:
      /\b(?:no|not|never|doesn'?t|does\s+not|don'?t|do\s+not|wears?\s+no)\b[^.!?\n]{0,20}\b(?:contact\s+lens(?:es)?|lenses)\b|\bwithout\s+(?:contact\s+)?lenses\b|لنز ندارد|لنز نمی ?زند|لنز ?زده/i,
  },
];

export interface EyeProtocolState {
  statuses: Record<string, ProtocolAnswerStatus>;
  answered: string[];
  unanswered: string[];
  unansweredQuestions: string[];
  present: string[];
  /** All questions answered and no positive finding. */
  resolved: boolean;
}

function protocolStatusFor(
  question: EyeProtocolQuestion,
  text: string,
): ProtocolAnswerStatus {
  const present = unnegated(question.present, text);
  const denied =
    question.denied.test(text) || patternIsDenied(question.present, text);
  if (present) return "present";
  if (denied) return "denied";
  return "unknown";
}

/**
 * Evaluate the eye protocol over the whole consultation. The latest message
 * wins for each question; earlier answers are retained only when the latest
 * message did not address that question. This avoids both "resolved because
 * one arbitrary sentence had enough negations" and "active forever".
 */
export function evaluateEyeProtocol(
  latestMessage: string,
  priorCaseText = "",
): EyeProtocolState {
  const latest = normaliseHealthText(latestMessage);
  const prior = normaliseHealthText(priorCaseText);
  const statuses: Record<string, ProtocolAnswerStatus> = {};

  for (const question of EYE_PROTOCOL) {
    let status = protocolStatusFor(question, latest);
    if (status === "unknown" && prior) {
      status = protocolStatusFor(question, prior);
    }
    statuses[question.id] = status;
  }

  const answered = EYE_PROTOCOL.filter(
    (question) => statuses[question.id] !== "unknown",
  );
  const unanswered = EYE_PROTOCOL.filter(
    (question) => statuses[question.id] === "unknown",
  );
  const present = EYE_PROTOCOL.filter(
    (question) => statuses[question.id] === "present",
  );

  return {
    statuses,
    answered: answered.map((question) => question.id),
    unanswered: unanswered.map((question) => question.id),
    unansweredQuestions: unanswered.map((question) => question.question),
    present: present.map((question) => question.id),
    resolved: unanswered.length === 0 && present.length === 0,
  };
}

/** True when the case's eye protocol is fully answered and non-positive. */
export function eyeRednessResolved(text: string): boolean {
  return evaluateEyeProtocol(text).resolved;
}

/** Focused questions attached to the eye-redness caution rule. */
export const EYE_REDNESS_FOLLOW_UPS: string[] = EYE_PROTOCOL.map(
  (question) => question.question,
);

/** Focused questions attached to the medicine-interaction caution rule. */
export const MEDICATION_INTERACTION_FOLLOW_UPS: string[] = [
  "Have the customer's medicines and this product been checked for interactions against a reliable reference?",
];

/** Per-rule follow-up questions used by the assessment engine. */
export const CAUTION_FOLLOW_UPS: Record<string, string[]> = {
  "eye-redness-unresolved": EYE_REDNESS_FOLLOW_UPS,
  "eye-pain-unresolved": EYE_REDNESS_FOLLOW_UPS,
  "medication-combination-question": MEDICATION_INTERACTION_FOLLOW_UPS,
};

/**
 * Caution rules that share the tracked eye protocol. They are resolved by the
 * same complete-answer rule, not by individual keyword counts.
 */
export const EYE_PROTOCOL_CAUTION_IDS = new Set([
  "eye-redness-unresolved",
  "eye-pain-unresolved",
]);

/** Ids of rules whose questions must be asked before any product is shown. */
export const CAUTION_RULE_IDS = new Set(CAUTION_RULES.map((rule) => rule.id));
