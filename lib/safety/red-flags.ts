/**
 * Deterministic red-flag safety engine.
 *
 * This is deliberately rule-based and independent of any language model. The
 * model may *explain* the assessment, but it can never override or downgrade it.
 *
 * States:
 *   HIGH_RISK   — a concerning feature needs urgent evaluation or referral.
 *   UNRESOLVED  — important safety information is still missing.
 *   LOWER_RISK  — no high-risk feature identified from the available facts
 *                 (this is NOT a diagnosis and NOT a guarantee of safety).
 */

import type {
  CaseFacts,
  SafetyAssessment,
  SafetySeverity,
  SafetyStatus,
} from "@/types/ai";

interface RedFlagRule {
  id: string;
  /** Human label used in the explanation. */
  label: string;
  /** Lower-cased substrings; any match fires the rule. */
  terms: string[];
  /**
   * Optional predicate for combination rules that need more than a substring
   * match (for example a pain score together with a body location). Receives
   * the lower-cased haystack.
   */
  test?: (text: string) => boolean;
  explanation: string;
  nextStep: string;
}

/** Normalise Persian/Arabic-Indic digits to ASCII so "۱۰/۱۰" is understood. */
function normaliseDigits(text: string): string {
  return text.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Parse a pain score such as "10/10" or "10 out of 10"; null when absent. */
function painScore(text: string): number | null {
  const match = normaliseDigits(text).match(
    /\b(\d{1,2})\s*(?:\/|out of)\s*10\b/,
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

const EYE_TERMS =
  /\b(?:eye|eyes|ocular|eyeball|cornea|vision|sight)\b|چشم|بینایی|قرنیه/i;
const PAIN_TERMS =
  /\b(?:pain|painful|hurts?|hurting|aching|ache|sore|soreness|discomfort)\b|درد|دردناک/i;
const SEVERE_TERMS =
  /\b(?:severe|severely|intense|intensely|extreme|extremely|unbearable|excruciating|agoni[sz]ing|intolerable|worst|killing me|really bad)\b|شدید|طاقت ?فرسا/i;

/**
 * A pain score of 8/10 or higher, or extreme pain wording, is treated as
 * urgent regardless of the body part it is describing.
 */
function isSeverePain(text: string): boolean {
  if (!PAIN_TERMS.test(text)) return false;
  const score = painScore(text);
  if (score !== null && score >= 8) return true;
  return SEVERE_TERMS.test(text);
}

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: "cardiac",
    label: "possible cardiac event",
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
    id: "abdominal-emergency",
    label: "severe abdominal pain",
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
    nextStep: "Seek emergency care immediately.",
  },
  {
    id: "meningitis",
    label: "fever with neck stiffness",
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
    id: "infant-fever",
    label: "young infant with fever",
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
    terms: [],
    test: (text) => isSeverePain(text),
    explanation:
      "Pain rated 8/10 or higher, or described as unbearable or excruciating, needs urgent assessment.",
    nextStep:
      "Arrange urgent medical assessment today rather than relying on over-the-counter products alone.",
  },
  {
    id: "eye-emergency",
    label: "acute eye problem",
    terms: [
      "chemical in my eye",
      "chemical in the eye",
      "chemical burn",
      "something in my eye",
      "object in my eye",
      "foreign body in my eye",
      "eye injury",
      "injured my eye",
      "eye trauma",
      "hit in the eye",
      "sudden eye pain",
      "can't open my eye",
      "cannot open my eye",
      "severe eye pain",
      "eye pain is severe",
      "سوختگی چشم",
      "آسیب چشم",
      "درد شدید چشم",
    ],
    test: (text) => EYE_TERMS.test(text) && isSeverePain(text),
    explanation:
      "Severe or sudden eye pain, an eye injury or chemical exposure can threaten sight (for example acute glaucoma, a corneal ulcer or a penetrating injury).",
    nextStep:
      "Refer for same-day emergency eye assessment; do not apply drops or ointments before the eye is examined.",
  },
];

function haystack(facts: CaseFacts, rawMessage: string): string {
  return [
    rawMessage,
    facts.summary,
    ...facts.symptoms,
    ...facts.statedFacts,
    facts.duration ?? "",
  ]
    .join(" \n ")
    .toLowerCase();
}

function isCustomerCase(facts: CaseFacts): boolean {
  return facts.symptoms.length > 0;
}

function buildQuestions(facts: CaseFacts): string[] {
  const questions: string[] = [];
  if (!facts.duration) questions.push("How long has this been going on?");
  if (facts.symptoms.length > 0) {
    questions.push("How severe is it, and is it getting better or worse?");
  }
  if (facts.age === null) questions.push("How old is the customer?");
  if (facts.pregnancy === null && facts.age === null) {
    questions.push("Is the customer pregnant or breastfeeding?");
  }
  if (facts.medications.length === 0) {
    questions.push(
      "Is the customer taking any other medicines, including OTC products and supplements?",
    );
  }
  if (facts.allergies.length === 0) {
    questions.push("Does the customer have any known allergies or ingredient sensitivities?");
  }
  return questions.slice(0, 5);
}

function severityFor(status: SafetyStatus): SafetySeverity {
  if (status === "HIGH_RISK") return "critical";
  if (status === "UNRESOLVED") return "warning";
  return "info";
}

/**
 * Assess the case. `deterministicOnly` is set by the pipeline when the model
 * was unavailable, so the UI can be honest about what ran.
 */
export function assessSafety(
  facts: CaseFacts,
  rawMessage: string,
): SafetyAssessment {
  const text = haystack(facts, rawMessage);
  const matched = RED_FLAG_RULES.filter(
    (rule) =>
      rule.terms.some((term) => text.includes(term)) ||
      rule.test?.(text) === true,
  );

  if (matched.length > 0) {
    const status: SafetyStatus = "HIGH_RISK";
    return {
      status,
      severity: severityFor(status),
      title: "Urgent safety concern",
      explanation: `This case may involve a red flag: ${matched
        .map((rule) => rule.label)
        .join("; ")}. ${matched.map((rule) => rule.explanation).join(" ")}`,
      questions: [],
      nextSteps: Array.from(new Set(matched.map((rule) => rule.nextStep))),
      triggers: matched.map((rule) => rule.id),
    };
  }

  if (isCustomerCase(facts)) {
    const questions = buildQuestions(facts);
    if (questions.length > 0) {
      const status: SafetyStatus = "UNRESOLVED";
      return {
        status,
        severity: severityFor(status),
        title: "More information needed",
        explanation:
          "No urgent red flag was identified from what has been shared so far, but important information is missing before a safe suggestion can be made.",
        questions,
        nextSteps: [],
        triggers: [],
      };
    }
  }

  return {
    status: "LOWER_RISK",
    severity: "info",
    title: "No red flags identified",
    explanation:
      "No urgent warning signs were identified from the information provided. This is not a diagnosis and does not guarantee the customer is safe.",
    questions: [],
    nextSteps: [],
    triggers: [],
  };
}
