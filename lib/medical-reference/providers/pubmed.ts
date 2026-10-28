/**
 * PubMed E-utilities adapter (ESearch → ESummary → EFetch).
 *
 * - ESearch finds relevant PMIDs.
 * - ESummary returns title, authors, journal, publication date, DOI and an
 *   "Has Abstract" attribute that lets us distinguish abstract availability.
 * - EFetch retrieves the abstract text when the user opens a detail view.
 *
 * NCBI's rate limits and `tool`/`email` guidance are respected. A single paper
 * is never treated as a universal treatment recommendation.
 */

import { MEDREF_NCBI_EMAIL, MEDREF_NCBI_TOOL } from "../config";
import { stripHtml, truncateText } from "../html";
import { requestJson, requestText } from "../http";
import { findAll, parseXml } from "../xml";
import type { MedicalReference, MedicalReferenceDetail } from "../types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function ncbiParams(extra: Record<string, string>): string {
  const params = new URLSearchParams({
    tool: MEDREF_NCBI_TOOL,
    email: MEDREF_NCBI_EMAIL,
    retmode: "json",
    ...extra,
  });
  return params.toString();
}

interface ESummaryAuthor {
  name?: string;
}

interface ESummaryDoc {
  uid?: string;
  title?: string;
  source?: string;
  fulljournalname?: string;
  pubdate?: string;
  sortpubdate?: string;
  authors?: ESummaryAuthor[];
  articleids?: Array<{ idtype?: string; value?: string }>;
  attributes?: string[];
  pmcrefcount?: string | number;
  elocationid?: string;
}

function fullTextAvailable(doc: ESummaryDoc): boolean {
  const hasPmcLink = (doc.articleids ?? []).some(
    (id) =>
      id.idtype === "pmc" || id.idtype === "pmcid" || id.idtype === "pmc_id",
  );
  const refCount = Number(doc.pmcrefcount ?? 0);
  return hasPmcLink || refCount > 0;
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`;
}

export function mapESummaryToReference(doc: ESummaryDoc): MedicalReference | null {
  const pmid = doc.uid;
  if (!pmid || !doc.title) return null;
  const hasAbstract = (doc.attributes ?? []).some(
    (attr) => attr.toLowerCase() === "has abstract",
  );
  return {
    source: "pubmed",
    sourceLabel: "PubMed",
    externalId: pmid,
    recordType: "research",
    title: doc.title,
    summary: null,
    url: pubmedUrl(pmid),
    updatedAt: null,
    language: "en",
    authors: (doc.authors ?? [])
      .map((author) => author.name ?? "")
      .filter(Boolean)
      .slice(0, 10),
    journal: doc.fulljournalname || doc.source || null,
    publicationDate: doc.pubdate ?? doc.sortpubdate ?? null,
    abstractAvailable: hasAbstract,
    fullTextAvailable: fullTextAvailable(doc),
  };
}

async function fetchSummaries(ids: string[]): Promise<MedicalReference[]> {
  const url = `${EUTILS}/esummary.fcgi?${ncbiParams({
    db: "pubmed",
    id: ids.join(","),
  })}`;
  const data = await requestJson<{ result?: Record<string, unknown> }>(url, {
    source: "pubmed",
  });
  const result = data.result ?? {};
  const out: MedicalReference[] = [];
  for (const id of ids) {
    const raw = result[id];
    if (raw && typeof raw === "object") {
      const mapped = mapESummaryToReference(raw as ESummaryDoc);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

export async function searchPubMed(
  query: string,
  limit = 8,
): Promise<MedicalReference[]> {
  const searchUrl = `${EUTILS}/esearch.fcgi?${ncbiParams({
    db: "pubmed",
    term: query,
    retmax: String(Math.min(limit, 10)),
    sort: "relevance",
  })}`;
  const data = await requestJson<{ esearchresult?: { idlist?: string[] } }>(
    searchUrl,
    { source: "pubmed" },
  );
  const ids = data.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];
  return fetchSummaries(ids);
}

/** EFetch the abstract (plain text) for a PMID, or null when absent. */
export async function fetchPubMedAbstract(pmid: string): Promise<string | null> {
  const url = `${EUTILS}/efetch.fcgi?${ncbiParams({
    db: "pubmed",
    id: pmid,
    rettype: "abstract",
    retmode: "xml",
  })}`;
  const xml = await requestText(url, { source: "pubmed" });
  const root = parseXml(xml);
  const abstractNodes = findAll(root, "AbstractText");
  const parts = abstractNodes
    .map((node) => stripHtml(node.text))
    .filter((text) => text.trim().length > 0);
  if (parts.length === 0) return null;
  return truncateText(parts.join("\n\n"), 6000);
}

export async function getPubMedDetail(
  pmid: string,
  stub: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  let reference = stub;
  // Refresh metadata (authors/journal/date) from ESummary for this single id.
  try {
    const [fresh] = await fetchSummaries([pmid]);
    if (fresh) reference = fresh;
  } catch {
    // Keep the stub; metadata will simply be unavailable.
  }

  const sections: MedicalReferenceDetail["sections"] = [];

  if (reference.authors && reference.authors.length > 0) {
    sections.push({
      heading: "Authors",
      body: reference.authors.join(", "),
    });
  }
  if (reference.journal) {
    sections.push({ heading: "Journal", body: reference.journal });
  }
  if (reference.publicationDate) {
    sections.push({ heading: "Publication date", body: reference.publicationDate });
  }

  let abstract: string | null = null;
  try {
    abstract = await fetchPubMedAbstract(pmid);
  } catch {
    abstract = null;
  }
  if (abstract) {
    sections.push({ heading: "Abstract", body: abstract });
  } else if (reference.abstractAvailable) {
    sections.push({
      heading: "Abstract",
      body: "An abstract is available on PubMed but could not be retrieved right now.",
    });
  } else {
    sections.push({
      heading: "Abstract",
      body: "No abstract is available for this record.",
    });
  }

  sections.push({
    heading: "Full text",
    body: reference.fullTextAvailable
      ? "Free full text may be available via PubMed Central."
      : "Free full text is not indicated for this record.",
  });

  return { reference, sections };
}
