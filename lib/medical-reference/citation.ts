/**
 * Citation formatting for source-backed medical references.
 *
 * Citations are rendered as a numbered list of source links, and a compact
 * variant is embedded into the AI prompt so the model can refer to `[1]`,
 * `[2]`, … without ever inventing a source or a URL.
 */

import type { MedicalReference } from "./types";

export function citationLabel(index: number): string {
  return `[${index + 1}]`;
}

/** Compact citation line for the AI prompt context. */
export function citationForPrompt(ref: MedicalReference, index: number): string {
  const parts = [`${citationLabel(index)} ${ref.title}`];
  if (ref.summary) parts.push(`— ${ref.summary}`);
  parts.push(`(source: ${ref.sourceLabel}, url: ${ref.url})`);
  return parts.join(" ");
}

/** Human-readable citation for UI rendering. */
export function citationLine(ref: MedicalReference, index: number): string {
  return `${citationLabel(index)} ${ref.title} — ${ref.sourceLabel}`;
}
