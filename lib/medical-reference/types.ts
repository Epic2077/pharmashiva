/**
 * Shared types for the Medical Reference integration.
 *
 * These types cross the server↔client boundary (search results are rendered by
 * server components, and chat references are serialized as stream events), so
 * they must stay free of server-only imports. Every record carries its source
 * and a canonical link back to the original page.
 */

export type MedicalSource =
  | "medlineplus"
  | "pubmed"
  | "dailymed"
  | "rxnorm"
  | "pubchem";

export type ReferenceRecordType =
  | "medical_topic"
  | "research"
  | "drug_label"
  | "ingredient"
  | "terminology";

/** User-facing search categories; only the ones with real implementations. */
export type ReferenceFilter =
  | "all"
  | "conditions"
  | "definitions"
  | "drugs"
  | "supplements"
  | "research";

export interface MedicalReference {
  source: MedicalSource;
  /** Human-readable source name for attribution. */
  sourceLabel: string;
  /** Stable identifier inside the source (setid, pmid, cid, rxcui, slug). */
  externalId: string;
  recordType: ReferenceRecordType;
  title: string;
  /** Source-provided summary/snippet, or null when the source has none. */
  summary: string | null;
  /** Canonical link to the original record. */
  url: string;
  /** Source publication/update date, when provided. */
  updatedAt: string | null;
  /** Language of the source record, when known. */
  language: string | null;

  // Research records (PubMed).
  authors?: string[] | null;
  journal?: string | null;
  publicationDate?: string | null;
  abstractAvailable?: boolean;
  fullTextAvailable?: boolean;

  // Ingredient records (PubChem / RxNorm).
  properties?: Record<string, string> | null;
  synonyms?: string[] | null;
}

export interface ReferenceSection {
  heading: string;
  /** Plain text (HTML already stripped). */
  body: string;
}

export interface MedicalReferenceDetail {
  reference: MedicalReference;
  sections: ReferenceSection[];
}

export interface MedicalSearchSourceStatus {
  source: MedicalSource;
  ok: boolean;
  count: number;
}

export interface MedicalSearchResult {
  results: MedicalReference[];
  /** Per-source status so partial coverage can be communicated honestly. */
  sources: MedicalSearchSourceStatus[];
  /** True when at least one requested source failed. */
  partial: boolean;
  /** The normalized query that was actually searched. */
  query: string;
}
