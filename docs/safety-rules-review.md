# Safety ruleset review (v1.2.0)

> **Status: pending qualified clinician/pharmacist sign-off.**
>
> This document records the coverage review of the deterministic red-flag
> ruleset in `lib/safety/rules.ts`. It is a coverage checklist, **not** a
> clinical protocol. Nothing here should be described as clinically complete
> until a qualified clinician has reviewed it against current local guidance
> and signed it off.

## Architecture

- `lib/safety/rules.ts` — version-controlled rule data (`SAFETY_RULESET_VERSION`)
  and the eye protocol. No IO, no model calls.
- `lib/safety/text.ts` — Persian/Arabic/digit normalisation, clause-scoped
  negation, hypothetical/historical detection and structured findings.
- `lib/safety/red-flags.ts` — `assessSafety()` (deterministic) and
  escalation-only `applyModelConcerns()`.
- The AI may add concerns and explanations but can never downgrade a
  deterministic finding. Invalid/time-out AI output leaves the deterministic
  assessment intact and marks it `deterministicOnly`.

## Coverage matrix

| Body system / concern                        | Rule ids                          | Level     | Evidence basis                               | Review status         |
| -------------------------------------------- | --------------------------------- | --------- | -------------------------------------------- | --------------------- |
| Cardiac (chest pain/pressure, radiation)     | `cardiac`                         | emergency | Common emergency triage guidance             | Needs clinical review |
| Breathing difficulty                         | `breathing`                       | emergency | Common emergency triage guidance             | Needs clinical review |
| Severe allergic reaction / anaphylaxis       | `anaphylaxis`                     | emergency | Common emergency triage guidance             | Needs clinical review |
| Stroke-like symptoms                         | `stroke`                          | emergency | Time-critical stroke guidance (FAST-like)    | Needs clinical review |
| Sudden severe headache / meningitis signs    | `severe-headache`, `meningitis`   | emergency | Common emergency triage guidance             | Needs clinical review |
| Internal / significant bleeding              | `bleeding`                        | emergency | Common emergency triage guidance             | Needs clinical review |
| Seizure / loss of consciousness              | `neurological`                    | emergency | Common emergency triage guidance             | Needs clinical review |
| Overdose / poisoning                         | `overdose`                        | emergency | Poison-control guidance                      | Needs clinical review |
| Self-harm risk                               | `self-harm`                       | emergency | Crisis guidance                              | Needs clinical review |
| Pregnancy warning signs                      | `pregnancy-emergency`             | emergency | Obstetric triage guidance                    | Needs clinical review |
| Chemical eye exposure                        | `eye-chemical-exposure`           | emergency | First-aid guidance (irrigate, urgent review) | Needs clinical review |
| Eye injury / foreign body                    | `eye-trauma`                      | urgent    | Eye triage guidance                          | Needs clinical review |
| Eye pain + vision change / light sensitivity | `eye-vision-threat`               | urgent    | Acute glaucoma/keratitis triage              | Needs clinical review |
| Red eye + contact lens                       | `eye-contact-lens-redness`        | urgent    | Contact-lens keratitis triage                | Needs clinical review |
| Severe abdominal pain                        | `abdominal-emergency`             | urgent    | Surgical red-flag triage                     | Needs clinical review |
| Young infant fever                           | `infant-fever`                    | urgent    | Paediatric fever guidance                    | Needs clinical review |
| Very severe pain (score/wording)             | `severe-pain`                     | urgent    | Pain triage convention                       | Needs clinical review |
| Spreading skin infection                     | `skin-infection`                  | urgent    | Wound/cellulitis triage                      | Needs clinical review |
| Significant burn                             | `burns`                           | urgent    | Burn first-aid triage                        | Needs clinical review |
| Adverse drug reaction                        | `adverse-drug-reaction`           | urgent    | Adverse-reaction triage                      | Needs clinical review |
| Red eye with protocol questions              | `eye-redness-unresolved`          | caution   | Eye triage protocol                          | Needs clinical review |
| Possible medicine interaction                | `medication-combination-question` | caution   | Interaction-checking requirement             | Needs clinical review |

## Known gaps / limitations (must be reviewed)

1. **Subject attribution** — the deterministic layer treats the customer /
   patient as the subject. A symptom described for a third party (for example
   a family member) is flagged conservatively; the model prompt is asked to
   preserve the subject, but the keyword layer cannot always tell.
2. **Quotations and negations inside reported speech** are not fully
   distinguished by the deterministic layer.
3. **Condition-specific thresholds** (for example exact infant ages, burn
   surface area, dehydration scoring) are not enumerated; rules use explicit
   wording rather than invented scoring.
4. **Medicine interactions** require a separate, source-backed interaction
   database. The system currently warns that interactions are unverified
   rather than asserting safety.
5. **Pediatric, pregnancy and renal/hepatic dosing** are outside this ruleset.
6. **Local emergency numbers and languages** are not encoded in the rules.
7. **Symptom duration/severity** for most non-eye concerns is not used to
   raise urgency; only explicit severe wording/pain score is used.

## Review procedure

1. A qualified clinician/pharmacist reviews each rule's terms, level,
   explanation and next step against current authoritative guidance.
2. Any changed wording updates `SAFETY_RULESET_VERSION` and this document.
3. Deterministic tests in `tests/safety-assessment.test.ts` and
   `tests/safety-case-awareness.test.ts` must be updated with the review.
4. Only after sign-off should this ruleset be described as clinically
   reviewed.
