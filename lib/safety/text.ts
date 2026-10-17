/**
 * Negation-aware text handling for the deterministic safety layer.
 *
 * The old implementation used `text.includes(term)`, which cannot tell
 * "chest pain" from "no chest pain". This module provides:
 *   - Persian/Arabic/whitespace/digit normalisation,
 *   - local (clause-scoped) negation detection,
 *   - explicit resolution/historical detection,
 *   - a curated, structured clinical finding extractor.
 *
 * Scope is deliberately narrow: it never diagnoses and never guesses at
 * missing facts. A finding is only `present`, `denied`, `historical` or
 * `unknown`, and every decision is traceable to the clause that produced it.
 */

/** Normalise Persian/Arabic-Indic digits to ASCII so "۱۰/۱۰" is understood. */
export function normaliseDigits(text: string): string {
  return text.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Normalise Persian/Arabic characters, invisible marks, diacritics, digits and
 * whitespace so the same phrase matches regardless of keyboard/layout drift.
 * Everything is lower-cased.
 */
export function normaliseHealthText(text: string): string {
  if (typeof text !== "string") return "";
  return (
    normaliseDigits(text)
      // Arabic yeh/kaf → Persian forms.
      .replace(/[\u064a\u0649]/g, "\u06cc")
      .replace(/\u0643/g, "\u06a9")
      // Zero-width and bidi control characters.
      .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, " ")
      // Arabic diacritics/tatweel.
      .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
      // Unify whitespace.
      .replace(/[\u00a0\t\r]+/g, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .toLowerCase()
  );
}

/** Negation tokens (English + Persian). */
const NEGATION_TOKEN =
  /(?:\bno\b|\bnot\b|\bnone\b|\bnever\b|\bwithout\b|\bdoesn'?t\b|\bdoes not\b|\bdon'?t\b|\bdo not\b|\bdidn'?t\b|\bdid not\b|\bisn'?t\b|\bis not\b|\baren'?t\b|\bare not\b|\bhasn'?t\b|\bhas not\b|\bdenies?\b|\bdeny\b|\bnegative for\b|ندارد|ندارم|ندارند|نیست|بدون|هیچ)/i;

/** Words that mean the mention is uncertain, not a true denial. */
const UNCERTAINTY =
  /\b(?:not\s+sure|not\s+certain|can'?t\s+tell|unsure|maybe|possibly|perhaps|might|if)\b|شاید|مطمئن نیستم|نمی ?دانم/i;

/** Phrases that explicitly say the problem is gone. */
const RESOLVED =
  /\b(?:resolved|resolves|went away|gone away|has gone|settled|no longer|back to normal|used to have|cleared up)\b|خوب شد|رفع شد|از بین رفت|دیگر ندارد|دیگه نداره|قبلا/i;

/** Words that end a local clause for negation purposes. */
const CONTRAST =
  /\b(?:but|however|although|though|yet|except|then|now)\b|ولی|اما|منتها|اما الان/i;

/** Clauses that describe a hypothetical scenario, not the patient. */
const HYPOTHETICAL =
  /^\s*(?:if|what\s+if|suppose|supposing|imagine|hypothetically|would|اگر|اگز|فرض)/i;

const CLAUSE_BOUNDARY = /[.!?;،\n]/;

interface LocalScope {
  /** "negative" when the term is inside a negation scope. */
  kind: "none" | "negative" | "uncertain" | "hypothetical";
  /** The local clause the term appeared in (for evidence/debugging). */
  clause: string;
}

/**
 * Determine whether the term occurrence starting at `index` is locally
 * negated. Scope does not cross sentence boundaries or contrast conjunctions,
 * so "no chest pain or shortness of breath" covers both items while
 * "no fever, but chest pain" does not.
 */
function negationScopeAt(
  text: string,
  index: number,
  termLength: number,
): LocalScope {
  const before = text.slice(Math.max(0, index - 96), index);
  let clauseStart = 0;
  for (const match of before.matchAll(
    new RegExp(CLAUSE_BOUNDARY.source, "g"),
  )) {
    clauseStart = (match.index ?? 0) + match[0].length;
  }
  for (const match of before.matchAll(new RegExp(CONTRAST.source, "gi"))) {
    clauseStart = Math.max(clauseStart, (match.index ?? 0) + match[0].length);
  }
  const clause = before.slice(clauseStart);
  if (HYPOTHETICAL.test(clause)) {
    return { kind: "hypothetical", clause };
  }
  const negations = [
    ...clause.matchAll(new RegExp(NEGATION_TOKEN.source, "gi")),
  ];
  const last = negations[negations.length - 1];
  if (!last || last.index === undefined) {
    return { kind: "none", clause };
  }

  const afterNegation = clause.slice(last.index);
  // "not sure if chest pain" is uncertainty, never a denial.
  if (UNCERTAINTY.test(afterNegation)) {
    return { kind: "uncertain", clause };
  }
  // A negation far from the term (another statement in the same clause) does
  // not reach it. This keeps "no chest pain" (short gap) negated while
  // "nothing helped the chest pain" is not silently discarded.
  if (afterNegation.length > 48) {
    return { kind: "none", clause };
  }

  // A suffix negation in Persian ("درد سینه ندارد") is checked after the term.
  void termLength;
  return { kind: "negative", clause };
}

/** True when a suffix negation follows the term (Persian). */
function hasSuffixNegation(text: string, endIndex: number): boolean {
  const after = text.slice(endIndex, endIndex + 18);
  return /^\s*(?:ندارد|ندارم|ندارند|نیست|نمی\s*کند|وجود ندارد)/i.test(after);
}

/**
 * Match a literal term only when at least one occurrence is not negated.
 * Terms that themselves start with a negation ("no fetal movement") remain
 * matchable.
 */
export function hasUnnegatedTerm(text: string, term: string): boolean {
  const haystack = normaliseHealthText(text);
  const needle = normaliseHealthText(term);
  if (!haystack || !needle) return false;
  if (/^\s*(?:no|without)\s+/i.test(needle)) return haystack.includes(needle);

  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return false;
    const scope = negationScopeAt(haystack, index, needle.length);
    const suffixNegated = hasSuffixNegation(haystack, index + needle.length);
    if (
      (scope.kind === "none" || scope.kind === "uncertain") &&
      !suffixNegated
    ) {
      return true;
    }
    from = index + Math.max(needle.length, 1);
  }
  return false;
}

/** True when the term appears and every occurrence is locally negated. */
export function termIsDenied(text: string, term: string): boolean {
  const haystack = normaliseHealthText(text);
  const needle = normaliseHealthText(term);
  if (!haystack || !needle) return false;
  let occurrences = 0;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    occurrences += 1;
    const scope = negationScopeAt(haystack, index, needle.length);
    const suffixNegated = hasSuffixNegation(haystack, index + needle.length);
    if (scope.kind !== "negative" && !suffixNegated) return false;
    from = index + Math.max(needle.length, 1);
  }
  return occurrences > 0;
}

/**
 * Whether the *latest* mention of a term in the text is unnegated. Used to
 * resolve contradictions across stored turns: if the customer later said
 * "no chest pain", the earlier positive mention must not win.
 */
export function lastMentionIsUnnegated(text: string, term: string): boolean {
  const haystack = normaliseHealthText(text);
  const needle = normaliseHealthText(term);
  if (!haystack || !needle) return false;
  const index = haystack.lastIndexOf(needle);
  if (index < 0) return false;
  const scope = negationScopeAt(haystack, index, needle.length);
  if (scope.kind === "negative" || scope.kind === "hypothetical") return false;
  return !hasSuffixNegation(haystack, index + needle.length);
}

/**
 * True when an unnegated mention of the term sits next to explicit resolution
 * wording ("chest pain last week, but it resolved"). Such mentions are
 * historical, not an active finding.
 */
export function isResolvedMention(text: string, term: string): boolean {
  const haystack = normaliseHealthText(text);
  const needle = normaliseHealthText(term);
  if (!haystack || !needle) return false;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return false;
    const scope = negationScopeAt(haystack, index, needle.length);
    if (scope.kind === "none" || scope.kind === "uncertain") {
      const window = haystack.slice(
        Math.max(0, index - 80),
        index + needle.length + 80,
      );
      if (RESOLVED.test(window)) return true;
    }
    from = index + Math.max(needle.length, 1);
  }
  return false;
}

/** Plain "normal state" wording (used only to stop stale prior findings). */
const NORMAL_STATE =
  /\b(?:fine|normal|clear|ok|okay|good|unchanged|back to normal)\b|عادی|طبیعی|خوب|سالم|طبیعی است/i;

/** True when the message explicitly says a symptom is resolved. */
export function mentionsExplicitResolution(text: string): boolean {
  return RESOLVED.test(normaliseHealthText(text));
}

/**
 * True when the message reports a normal or resolved state. Used to avoid
 * keeping a stale earlier-turn predicate finding (e.g. "vision is fine now").
 */
export function mentionsResolution(text: string): boolean {
  const normalised = normaliseHealthText(text);
  return RESOLVED.test(normalised) || NORMAL_STATE.test(normalised);
}

/** True when the message contains local uncertainty. */
export function mentionsUncertainty(text: string): boolean {
  return UNCERTAINTY.test(normaliseHealthText(text));
}

/* ── Structured clinical findings ─────────────────────────────── */

export type FindingStatus = "present" | "denied" | "historical" | "unknown";

export interface ClinicalFinding {
  /** Stable finding/rule id. */
  id: string;
  /** Human label. */
  label: string;
  status: FindingStatus;
  /** Short evidence excerpt from the source text (never a full message). */
  evidence: string;
}

interface FindingGroup {
  id: string;
  label: string;
  pattern: RegExp;
  /** Terms (used for resolution detection). */
  terms: string[];
}

/**
 * Curated finding groups. This is not a diagnosis catalogue: it exists so the
 * assessment can represent present/denied/unknown/historical facts explicitly
 * and ask the right protocol questions. The version-controlled red-flag rules
 * remain authoritative for urgency.
 */
const FINDING_GROUPS: FindingGroup[] = [
  {
    id: "red_eye",
    label: "Red eye",
    pattern:
      /\b(?:red (?:eye|eyes)|eyes? (?:are|is|look|looks) red|bloodshot)\b|قرمزی چشم|چشم(?:م|ش|ت)? قرمز/i,
    terms: ["red eyes", "red eye", "قرمزی چشم"],
  },
  {
    id: "eye_pain",
    label: "Eye pain",
    pattern:
      /\b(?:eye|eyes|ocular)\b[^.!?\n]{0,24}\b(?:pain|painful|hurt|hurts|aching|sore)\b|\b(?:pain|painful|hurt|hurts|aching|sore)\b[^.!?\n]{0,24}\b(?:eye|eyes)\b|درد چشم|چشم درد/i,
    terms: ["eye pain", "eyes hurt", "درد چشم"],
  },
  {
    id: "vision_change",
    label: "Vision change",
    pattern:
      /\b(?:blurred|blurry|blur)\s+vision|vision\s+(?:is\s+)?(?:blurr\w+|gett\w+\s+worse|worse|chang\w+)|seeing\s+(?:halos|double)|double vision|loss of vision|sudden vision loss|تاری دید|تار شدن دید|دوبینی/i,
    terms: ["blurred vision", "vision change", "تاری دید"],
  },
  {
    id: "light_sensitivity",
    label: "Light sensitivity",
    pattern:
      /\b(?:light sensitivity|sensitive to light|photophobia)\b|حساسیت به نور/i,
    terms: ["light sensitivity", "حساسیت به نور"],
  },
  {
    id: "eye_injury",
    label: "Eye injury or foreign body",
    pattern:
      /\b(?:eye injury|injured my eye|eye trauma|hit in the eye|something in my eye|object in my eye|foreign body in my eye)\b|آسیب چشم|ضربه به چشم/i,
    terms: ["eye injury", "آسیب چشم"],
  },
  {
    id: "chemical_exposure",
    label: "Chemical exposure",
    pattern:
      /\b(?:chemical|acid|alkali|bleach|detergent)\b[^.!?\n]{0,32}\b(?:eye|eyes)\b|\b(?:eye|eyes)\b[^.!?\n]{0,32}\b(?:chemical|acid|alkali|bleach|detergent)\b|مواد شیمیایی[^.!?\n]{0,20}چشم|اسید[^.!?\n]{0,20}چشم/i,
    terms: ["chemical in my eye", "chemical splashed", "مواد شیمیایی داخل چشم"],
  },
  {
    id: "contact_lens",
    label: "Contact-lens use",
    pattern: /\b(?:contact lens(?:es)?|lenses)\b|لنز/i,
    terms: ["contact lenses", "contact lens", "لنز"],
  },
  {
    id: "chest_pain",
    label: "Chest pain or pressure",
    pattern:
      /\bchest (?:pain|pressure|tightness|heaviness)\b|\bpain in (?:my |the )?chest\b|درد قفسه سینه|درد سینه|فشار روی سینه/i,
    terms: ["chest pain", "chest pressure", "درد قفسه سینه"],
  },
  {
    id: "breathing",
    label: "Breathing difficulty",
    pattern:
      /\b(?:difficulty|trouble|shortness)\b[^.!?\n]{0,12}\bbreath\w*|\b(?:short of breath|can'?t breathe|cannot breathe|wheezing)\b|تنگی نفس|تنفس مشکل/i,
    terms: ["difficulty breathing", "shortness of breath", "تنگی نفس"],
  },
  {
    id: "abdominal_pain",
    label: "Abdominal pain",
    pattern:
      /\b(?:stomach|abdominal|belly)\s+(?:pain|cramp\w*|ache)\b|درد (?:شکم|معده)/i,
    terms: ["abdominal pain", "stomach pain", "درد شکم", "درد معده"],
  },
];

function evidenceFor(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return "";
  const start = Math.max(0, match.index - 24);
  return text.slice(start, match.index + match[0].length + 24).trim();
}

function patternStatus(
  group: FindingGroup,
  latest: string,
  prior: string,
): ClinicalFinding | null {
  const inLatest = group.pattern.test(latest);
  const latestUnnegated =
    group.terms.some((term) => hasUnnegatedTerm(latest, term)) ||
    unnegatedPattern(group.pattern, latest);

  if (inLatest) {
    if (latestUnnegated) {
      const resolved =
        group.terms.some((term) => isResolvedMention(latest, term)) ||
        (mentionsExplicitResolution(latest) && !mentionsUncertainty(latest));
      return {
        id: group.id,
        label: group.label,
        status: resolved ? "historical" : "present",
        evidence: evidenceFor(latest, group.pattern),
      };
    }
    // A hypothetical mention is not a finding at all; fall through to the
    // stored case instead of mislabelling it as denied.
    if (!patternIsHypothetical(group.pattern, latest)) {
      return {
        id: group.id,
        label: group.label,
        status: "denied",
        evidence: evidenceFor(latest, group.pattern),
      };
    }
  }

  if (group.pattern.test(prior) && unnegatedPattern(group.pattern, prior)) {
    return {
      id: group.id,
      label: group.label,
      status: "present",
      evidence: evidenceFor(prior, group.pattern),
    };
  }

  return null;
}

/** Negation-aware regex match (local clause). */
export function unnegatedPattern(pattern: RegExp, text: string): boolean {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const haystack = normaliseHealthText(text);
  for (const match of haystack.matchAll(matcher)) {
    if (match.index === undefined) continue;
    const end = match.index + match[0].length;
    const scope = negationScopeAt(haystack, match.index, match[0].length);
    if (
      (scope.kind === "none" || scope.kind === "uncertain") &&
      !hasSuffixNegation(haystack, end)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when every positive-looking match is hypothetical ("if I had chest
 * pain"). Hypothetical examples must never be treated as present findings.
 */
export function patternIsHypothetical(pattern: RegExp, text: string): boolean {
  const haystack = normaliseHealthText(text);
  const matcher = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let found = false;
  for (const match of haystack.matchAll(matcher)) {
    if (match.index === undefined) continue;
    found = true;
    const scope = negationScopeAt(haystack, match.index, match[0].length);
    if (scope.kind !== "hypothetical") return false;
  }
  return found;
}

/** True when the pattern is present but every occurrence is negated. */
export function patternIsDenied(pattern: RegExp, text: string): boolean {
  const haystack = normaliseHealthText(text);
  const matcher = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let found = false;
  for (const match of haystack.matchAll(matcher)) {
    if (match.index === undefined) continue;
    found = true;
    const end = match.index + match[0].length;
    const scope = negationScopeAt(haystack, match.index, match[0].length);
    if (
      (scope.kind === "none" || scope.kind === "uncertain") &&
      !hasSuffixNegation(haystack, end)
    ) {
      return false;
    }
  }
  return found;
}

/**
 * Extract structured findings from the current message, falling back to the
 * stored case text only when the current message neither confirms nor denies a
 * finding. Latest answers take precedence over earlier turns.
 */
export function extractClinicalFindings(
  latestMessage: string,
  priorCaseText = "",
): ClinicalFinding[] {
  const latest = normaliseHealthText(latestMessage);
  const prior = normaliseHealthText(priorCaseText);
  const findings: ClinicalFinding[] = [];
  for (const group of FINDING_GROUPS) {
    const finding = patternStatus(group, latest, prior);
    if (finding) findings.push(finding);
  }
  return findings;
}

/** True when the status represents an active (needs-attention) finding. */
export function isActiveFinding(finding: ClinicalFinding): boolean {
  return finding.status === "present";
}
