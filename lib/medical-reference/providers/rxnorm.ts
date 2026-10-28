/**
 * RxNorm / RxNav API adapter.
 *
 * RxNorm is used strictly as a terminology and matching layer: it normalizes
 * drug/ingredient names and preserves the standard RxCUI identifiers so other
 * sources can be connected by a verified id. It is never the sole source of
 * clinical advice, and two similarly named products are never assumed to have
 * identical formulations.
 */

import { requestJson } from "../http";
import type { MedicalReference, MedicalReferenceDetail } from "../types";

const BASE = "https://rxnav.nlm.nih.gov/REST";

interface ConceptProperty {
  rxcui?: string;
  name?: string;
  synonym?: string;
  tty?: string;
  language?: string;
}

interface ConceptGroup {
  tty?: string;
  conceptProperties?: ConceptProperty[];
}

interface DrugsResponse {
  drugGroup?: { conceptGroup?: ConceptGroup[] };
}

/** Term types that represent an active ingredient. */
const INGREDIENT_TTYS = new Set(["IN", "PIN", "MIN"]);
/** Term types that represent a brand name or normalized drug concept. */
const NAME_TTYS = new Set(["BN", "SBD", "SCD"]);

function rxNormUrl(rxcui: string): string {
  return `${BASE}/rxcui/${encodeURIComponent(rxcui)}/allrelated.json`;
}

export function mapRxNormProperty(property: ConceptProperty): MedicalReference | null {
  const rxcui = property.rxcui;
  const name = property.name?.trim();
  if (!rxcui || !name) return null;
  const tty = property.tty ?? "";
  const synonym = property.synonym?.trim();
  const isIngredient = INGREDIENT_TTYS.has(tty);
  return {
    source: "rxnorm",
    sourceLabel: "RxNorm",
    externalId: rxcui,
    recordType: isIngredient ? "ingredient" : "terminology",
    title: name,
    summary:
      synonym && synonym.toLowerCase() !== name.toLowerCase()
        ? `Also known as: ${synonym}`
        : null,
    url: rxNormUrl(rxcui),
    updatedAt: null,
    language: property.language ?? "en",
    synonyms: synonym ? [synonym] : null,
  };
}

export async function searchRxNorm(
  query: string,
  limit = 8,
): Promise<MedicalReference[]> {
  const url = `${BASE}/drugs.json?name=${encodeURIComponent(query)}`;
  const data = await requestJson<DrugsResponse>(url, { source: "rxnorm" });

  const out: MedicalReference[] = [];
  const seen = new Set<string>();
  const groups = data.drugGroup?.conceptGroup ?? [];

  // Prioritize ingredients, then brand/normalized names.
  const ordered = [...groups].sort((a, b) => {
    const aScore = INGREDIENT_TTYS.has(a.tty ?? "") ? 0 : NAME_TTYS.has(a.tty ?? "") ? 1 : 2;
    const bScore = INGREDIENT_TTYS.has(b.tty ?? "") ? 0 : NAME_TTYS.has(b.tty ?? "") ? 1 : 2;
    return aScore - bScore;
  });

  for (const group of ordered) {
    const tty = group.tty ?? "";
    if (!INGREDIENT_TTYS.has(tty) && !NAME_TTYS.has(tty)) continue;
    for (const property of group.conceptProperties ?? []) {
      const mapped = mapRxNormProperty(property);
      if (!mapped || seen.has(mapped.externalId)) continue;
      seen.add(mapped.externalId);
      out.push(mapped);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function getRxNormDetail(
  rxcui: string,
  reference: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  const sections: MedicalReferenceDetail["sections"] = [];

  if (reference.summary) {
    sections.push({ heading: "Names", body: reference.summary });
  }
  if (reference.synonyms && reference.synonyms.length > 0) {
    sections.push({
      heading: "Synonyms",
      body: reference.synonyms.join(", "),
    });
  }

  // List related active ingredients (verified relationships only).
  try {
    const relatedUrl = `${BASE}/rxcui/${encodeURIComponent(
      rxcui,
    )}/related.json?tty=IN`;
    const related = await requestJson<{
      relatedGroup?: { conceptGroup?: ConceptGroup[] };
    }>(relatedUrl, { source: "rxnorm" });
    const names = (related.relatedGroup?.conceptGroup ?? [])
      .flatMap((group) => group.conceptProperties ?? [])
      .map((property) => property.name)
      .filter((name): name is string => Boolean(name?.trim()));
    if (names.length > 0) {
      sections.push({
        heading: "Related active ingredients",
        body: [...new Set(names)].slice(0, 20).join(", "),
      });
    }
  } catch {
    // Relationship lookup is best-effort.
  }

  return { reference, sections };
}
