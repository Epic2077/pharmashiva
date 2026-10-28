/**
 * Public surface of the Medical Reference integration (server-only).
 *
 * Kept dependency-light and free of browser-unsafe imports so route handlers
 * and server components can import it freely.
 */

export type {
  MedicalReference,
  MedicalReferenceDetail,
  MedicalSearchResult,
  MedicalSource,
  ReferenceFilter,
  ReferenceRecordType,
  ReferenceSection,
} from "./types";

export {
  searchMedicalReferences,
  getMedicalReferenceDetail,
  medicalContextForPrompt,
  sourcesForFilter,
  stubReference,
  SOURCE_LABEL,
} from "./search";

export { normalizeQuery, isReferenceFilter, isPersianScript } from "./normalization";
export { resolveAlias } from "./aliases";
export { rankReferences } from "./ranking";
export { citationLabel, citationLine, citationForPrompt } from "./citation";
export { clearMedicalReferenceCache } from "./http";
