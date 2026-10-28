/**
 * Unified, server-side Medical Reference search.
 *
 * Routes a query to the relevant sources, runs them in parallel, ranks the
 * survivors, deduplicates only on a verified source+id key, and returns partial
 * results when a source fails. A failed source never fails the whole search.
 */

import type { LanguageCode } from "@/lib/i18n";
import { translateFaToEn } from "@/lib/translate";
import { resolveAlias } from "./aliases";
import {
  isPersianScript,
  isReferenceFilter,
  normalizeQuery,
} from "./normalization";
import { rankReferences } from "./ranking";
import type {
  MedicalReference,
  MedicalReferenceDetail,
  MedicalSearchResult,
  MedicalSource,
  ReferenceFilter,
} from "./types";
import { truncateText } from "./html";
import {
  getMedlinePlusDetail,
  searchMedlinePlus,
} from "./providers/medlineplus";
import { getPubMedDetail, searchPubMed } from "./providers/pubmed";
import { getDailyMedDetail, searchDailyMed } from "./providers/dailymed";
import { getRxNormDetail, searchRxNorm } from "./providers/rxnorm";
import { getPubChemDetail, searchPubChem } from "./providers/pubchem";
import { MEDREF_MAX_TOTAL } from "./config";

type ProviderSearch = (query: string, limit: number) => Promise<MedicalReference[]>;

const PROVIDERS: Record<MedicalSource, ProviderSearch> = {
  medlineplus: searchMedlinePlus,
  pubmed: searchPubMed,
  dailymed: searchDailyMed,
  rxnorm: searchRxNorm,
  pubchem: searchPubChem,
};

export const SOURCE_LABEL: Record<MedicalSource, string> = {
  medlineplus: "MedlinePlus",
  pubmed: "PubMed",
  dailymed: "DailyMed",
  rxnorm: "RxNorm",
  pubchem: "PubChem",
};

/**
 * Build a minimal reference from (source, id, title) so a detail page can
 * re-fetch the full record without passing every field through the URL.
 */
export function stubReference(
  source: MedicalSource,
  externalId: string,
  title: string,
): MedicalReference {
  const base: MedicalReference = {
    source,
    sourceLabel: SOURCE_LABEL[source],
    externalId,
    recordType: "medical_topic",
    title,
    summary: null,
    url: "",
    updatedAt: null,
    language: "en",
  };
  switch (source) {
    case "medlineplus":
      return {
        ...base,
        recordType: "medical_topic",
        url: `https://medlineplus.gov/${encodeURIComponent(externalId)}`,
      };
    case "pubmed":
      return {
        ...base,
        recordType: "research",
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(externalId)}/`,
      };
    case "dailymed":
      return {
        ...base,
        recordType: "drug_label",
        url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(externalId)}`,
      };
    case "rxnorm":
      return {
        ...base,
        recordType: "terminology",
        url: `https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(externalId)}/allrelated.json`,
      };
    case "pubchem":
      return {
        ...base,
        recordType: "ingredient",
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(externalId)}`,
      };
  }
}

export function sourcesForFilter(filter: ReferenceFilter): MedicalSource[] {
  switch (filter) {
    case "conditions":
      return ["medlineplus", "pubmed"];
    case "definitions":
      return ["medlineplus"];
    case "drugs":
      return ["dailymed", "rxnorm", "pubchem"];
    case "supplements":
      return ["pubchem", "medlineplus", "pubmed"];
    case "research":
      return ["pubmed"];
    case "all":
      return ["medlineplus", "pubmed", "dailymed", "rxnorm", "pubchem"];
  }
}

/**
 * Turn a user query into an English query the sources can understand. Persian
 * text is resolved through the curated alias table first, then the bounded
 * translation service; if neither yields a usable English term the original
 * (normalized) text is used, which at worst returns no results rather than
 * inventing a mapping.
 */
async function resolveEnglishQuery(query: string): Promise<string> {
  if (!isPersianScript(query)) return query;
  const alias = resolveAlias(query);
  if (alias) return alias;
  try {
    const translated = await Promise.race([
      translateFaToEn(query),
      new Promise<string>((resolve) => setTimeout(() => resolve(query), 2500)),
    ]);
    return translated && translated !== query ? translated : query;
  } catch {
    return query;
  }
}

export interface SearchMedicalOptions {
  query: string;
  filter?: ReferenceFilter | string | null;
  limit?: number;
  /** UI language, accepted for symmetry with the rest of the app. */
  language?: LanguageCode;
}

export async function searchMedicalReferences(
  options: SearchMedicalOptions,
): Promise<MedicalSearchResult> {
  const rawQuery = normalizeQuery(options.query);
  const filter = isReferenceFilter(options.filter) ? options.filter : "all";
  const limit = Math.max(1, options.limit ?? 8);

  if (!rawQuery) {
    return { results: [], sources: [], partial: false, query: "" };
  }

  const query = await resolveEnglishQuery(rawQuery);
  const sources = sourcesForFilter(filter);

  const settled = await Promise.allSettled(
    sources.map((source) => PROVIDERS[source](query, limit)),
  );

  const collected: MedicalReference[] = [];
  const sourceStatus = sources.map((source, index) => {
    const result = settled[index];
    if (result?.status === "fulfilled") {
      collected.push(...result.value);
      return { source, ok: true, count: result.value.length };
    }
    return { source, ok: false, count: 0 };
  });

  const partial = sourceStatus.some((status) => !status.ok);

  // Deduplicate only on a verified source+id key.
  const seen = new Set<string>();
  const deduped = collected.filter((ref) => {
    const key = `${ref.source}:${ref.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = rankReferences(deduped, query);
  return {
    results: ranked.slice(0, MEDREF_MAX_TOTAL),
    sources: sourceStatus,
    partial,
    query: rawQuery,
  };
}

/** Dispatch a detail fetch to the provider that owns the record. */
export async function getMedicalReferenceDetail(
  source: MedicalSource,
  externalId: string,
  reference: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  switch (source) {
    case "medlineplus":
      return getMedlinePlusDetail(externalId, reference);
    case "pubmed":
      return getPubMedDetail(externalId, reference);
    case "dailymed":
      return getDailyMedDetail(externalId, reference);
    case "rxnorm":
      return getRxNormDetail(externalId, reference);
    case "pubchem":
      return getPubChemDetail(externalId, reference);
    default:
      return null;
  }
}

/**
 * Build the bounded text context handed to the AI model, as a numbered list of
 * source-backed records. This is the only medical text the model may rely on
 * when explaining a retrieved reference; it can never be asked to invent one.
 */
export function medicalContextForPrompt(
  references: MedicalReference[],
  maxChars = 5000,
): string {
  let out = "";
  for (let index = 0; index < references.length; index += 1) {
    const ref = references[index]!;
    const parts = [`[${index + 1}] ${ref.title}`];
    if (ref.summary) parts.push(`— ${truncateText(ref.summary, 350)}`);
    parts.push(`(source: ${ref.sourceLabel}, url: ${ref.url})`);
    const line = parts.join(" ");
    if (out.length + line.length + 2 > maxChars) break;
    out += `${line}\n\n`;
  }
  return out.trim();
}
