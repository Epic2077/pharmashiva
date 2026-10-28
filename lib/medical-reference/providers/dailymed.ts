/**
 * DailyMed REST API adapter (v2).
 *
 * - Search:   /dailymed/services/v2/spls.json?drug_name=…&page=1&pagesize=…
 * - Detail:   /dailymed/services/v2/spls/{setid}.json
 *
 * DailyMed returns official FDA drug labeling. We extract the label sections
 * the API exposes (indications, dosage, contraindications, warnings, adverse
 * reactions, ingredients) and always link back to the original label. Labeling
 * data is not a complete interaction checker, and coverage is not universal —
 * locally marketed or Persian-named products may be absent.
 */

import { stripHtml, truncateText } from "../html";
import { requestJson } from "../http";
import type { MedicalReference, MedicalReferenceDetail } from "../types";

const BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

interface DailyMedSplSummary {
  setid?: string;
  title?: string;
  published_date?: string;
  spl_version?: number | string;
}

interface DailyMedSearchResponse {
  data?: DailyMedSplSummary[];
}

function drugInfoUrl(setid: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setid)}`;
}

export function mapDailyMedSummary(
  item: DailyMedSplSummary,
): MedicalReference | null {
  const setid = item.setid;
  const title = item.title?.trim();
  if (!setid || !title) return null;
  return {
    source: "dailymed",
    sourceLabel: "DailyMed",
    externalId: setid,
    recordType: "drug_label",
    title,
    summary: null,
    url: drugInfoUrl(setid),
    updatedAt: item.published_date ?? null,
    language: "en",
  };
}

export async function searchDailyMed(
  query: string,
  limit = 8,
): Promise<MedicalReference[]> {
  const params = new URLSearchParams({
    drug_name: query,
    page: "1",
    pagesize: String(Math.min(limit, 10)),
  });
  const url = `${BASE}/spls.json?${params.toString()}`;
  const data = await requestJson<DailyMedSearchResponse>(url, {
    source: "dailymed",
  });
  const items = data.data ?? [];
  const out: MedicalReference[] = [];
  for (const item of items) {
    const mapped = mapDailyMedSummary(item);
    if (mapped) out.push(mapped);
    if (out.length >= limit) break;
  }
  return out;
}

/** Coerce a DailyMed SPL section value (string | string[] | object) to text. */
function sectionText(value: unknown): string {
  if (typeof value === "string") return stripHtml(value).trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => sectionText(entry))
      .filter(Boolean)
      .join("\n\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return stripHtml(record.text).trim();
    if (typeof record["#text"] === "string") {
      return stripHtml(record["#text"] as string).trim();
    }
  }
  return "";
}

const LABEL_SECTIONS: Array<[string, string]> = [
  ["indications_and_usage", "Indications and Usage"],
  ["dosage_and_administration", "Dosage and Administration"],
  ["dosage_and_administration_table", "Dosage and Administration"],
  ["contraindications", "Contraindications"],
  ["warnings", "Warnings and Precautions"],
  ["warnings_and_cautions", "Warnings and Precautions"],
  ["adverse_reactions", "Adverse Reactions"],
  ["purpose", "Purpose"],
  ["active_ingredient", "Active Ingredient"],
  ["inactive_ingredient", "Inactive Ingredient"],
  ["description", "Description"],
  ["how_supplied", "How Supplied"],
  ["storage_and_handling", "Storage and Handling"],
];

export async function getDailyMedDetail(
  setid: string,
  reference: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  const url = `${BASE}/spls/${encodeURIComponent(setid)}.json`;
  const data = await requestJson<Record<string, unknown>>(url, {
    source: "dailymed",
  });

  const sections: MedicalReferenceDetail["sections"] = [];
  const seen = new Set<string>();
  for (const [key, heading] of LABEL_SECTIONS) {
    const text = sectionText(data[key]).trim();
    if (!text) continue;
    // Merge duplicate headings (e.g. two dosage keys) instead of repeating.
    if (seen.has(heading)) {
      const existing = sections.find((section) => section.heading === heading);
      if (existing) {
        existing.body = truncateText(`${existing.body}\n\n${text}`, 8000);
      }
      continue;
    }
    seen.add(heading);
    sections.push({ heading, body: truncateText(text, 8000) });
  }

  return { reference, sections };
}
