/**
 * Pure planning of the `safety` stream event.
 *
 * The pipeline computes an *instant* deterministic assessment before the model
 * interprets the message and an *authoritative* one afterwards. This module
 * decides which ones actually reach the client:
 *
 *  - if the instant assessment was never sent, the authoritative one must be
 *    (a caution case must never end up without a safety alert);
 *  - if the instant one was already sent and the authoritative one is
 *    identical, nothing more is sent (no duplicate alerts);
 *  - if the authoritative one differs (e.g. escalated), it replaces the
 *    instant one.
 */

import type { SafetyAssessment } from "@/types/ai";

export function safetyEquals(
  a: SafetyAssessment,
  b: SafetyAssessment,
): boolean {
  return (
    a.status === b.status &&
    a.level === b.level &&
    a.recommendationPermission === b.recommendationPermission &&
    a.explanation === b.explanation &&
    a.recommendedNextStep === b.recommendedNextStep &&
    a.followUpQuestions.join("|") === b.followUpQuestions.join("|")
  );
}

export interface SafetyEventInput {
  /** The pre-interpretation deterministic assessment. */
  instantSafety: SafetyAssessment;
  /** Whether the instant assessment was already sent to the client. */
  instantEventSent: boolean;
  /** The post-interpretation authoritative assessment. */
  safety: SafetyAssessment;
  /** Pipeline condition for showing a safety assessment at all. */
  shouldShow: boolean;
}

/**
 * Whether the instant (pre-interpretation) assessment may be sent to the
 * client immediately. Deterministic red flags surface instantly; a caution
 * result is held back while the model is available, because the model can
 * escalate it (e.g. "yellow eyes in pregnancy") and flashing a "more
 * information needed" warning right before an urgent alert would mislead.
 */
export function shouldSendInstantSafety(
  instantSafety: SafetyAssessment,
  modelConfigured: boolean,
): boolean {
  if (!modelConfigured) return true;
  return instantSafety.status === "HIGH_RISK";
}

/**
 * Returns the assessment to emit (or null when nothing new should be sent).
 */
export function planSafetyEvent(
  input: SafetyEventInput,
): SafetyAssessment | null {
  if (!input.shouldShow) return null;
  // The instant assessment was never surfaced, so the authoritative one must
  // be — deduplication only applies to events the client actually saw.
  if (!input.instantEventSent) return input.safety;
  if (safetyEquals(input.instantSafety, input.safety)) return null;
  return input.safety;
}
