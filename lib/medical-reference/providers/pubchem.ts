/**
 * PubChem PUG REST adapter.
 *
 * PubChem identifies ingredients and resolves scientific synonyms, and returns
 * chemical properties (formula, molecular weight, IUPAC name). It is used only
 * to identify/describe a chemical — clinical effectiveness, safety and dosage
 * are never inferred from chemical data alone.
 */

import { requestJson } from "../http";
import type { MedicalReference, MedicalReferenceDetail } from "../types";

const BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";

interface CidResponse {
  IdentifierList?: { CID?: number[] };
}

interface PropertyEntry {
  CID?: number;
  IUPACName?: string;
  MolecularFormula?: string;
  MolecularWeight?: string | number;
}

interface PropertiesResponse {
  PropertyTable?: { Properties?: PropertyEntry[] };
}

interface SynonymEntry {
  CID?: number;
  Synonym?: string[];
}

interface SynonymsResponse {
  InformationList?: { Information?: SynonymEntry[] };
}

function pubChemUrl(cid: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

function propertyOf(
  properties: PropertyEntry[],
  cid: number,
): PropertyEntry | undefined {
  return properties.find((entry) => entry.CID === cid);
}

export function buildPubChemReference(
  cid: number,
  props: PropertyEntry | undefined,
  synonyms: string[],
): MedicalReference {
  const iupac = props?.IUPACName?.trim();
  const formula = props?.MolecularFormula?.trim();
  const weight = props?.MolecularWeight
    ? String(props.MolecularWeight)
    : null;

  const title = iupac || synonyms[0] || `Compound ${cid}`;
  const summaryParts: string[] = [];
  if (formula) summaryParts.push(`Molecular formula: ${formula}`);
  if (weight) summaryParts.push(`Molecular weight: ${weight}`);

  return {
    source: "pubchem",
    sourceLabel: "PubChem",
    externalId: String(cid),
    recordType: "ingredient",
    title,
    summary: summaryParts.join("; ") || null,
    url: pubChemUrl(cid),
    updatedAt: null,
    language: "en",
    properties: {
      IUPACName: iupac ?? "",
      MolecularFormula: formula ?? "",
      MolecularWeight: weight ?? "",
    },
    synonyms: synonyms.slice(0, 20),
  };
}

export async function searchPubChem(
  query: string,
  limit = 8,
): Promise<MedicalReference[]> {
  const cidUrl = `${BASE}/name/${encodeURIComponent(query)}/cids/JSON`;
  const cidData = await requestJson<CidResponse>(cidUrl, { source: "pubchem" });
  const cids = (cidData.IdentifierList?.CID ?? []).slice(0, limit);
  if (cids.length === 0) return [];

  const cidList = cids.join(",");
  const [propsResult, synonymsResult] = await Promise.allSettled([
    requestJson<PropertiesResponse>(
      `${BASE}/cid/${cidList}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
      { source: "pubchem" },
    ),
    requestJson<SynonymsResponse>(
      `${BASE}/cid/${cidList}/synonyms/JSON`,
      { source: "pubchem" },
    ),
  ]);

  const properties = propsResult.status === "fulfilled"
    ? (propsResult.value.PropertyTable?.Properties ?? [])
    : [];
  const synonymEntries = synonymsResult.status === "fulfilled"
    ? (synonymsResult.value.InformationList?.Information ?? [])
    : [];

  return cids.map((cid) => {
    const synonyms = (synonymEntries.find((entry) => entry.CID === cid)?.Synonym ?? [])
      .slice(0, 20);
    return buildPubChemReference(cid, propertyOf(properties, cid), synonyms);
  });
}

export async function getPubChemDetail(
  cid: string,
  stub: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  let reference = stub;
  try {
    const [propsResult, synonymsResult] = await Promise.allSettled([
      requestJson<PropertiesResponse>(
        `${BASE}/cid/${encodeURIComponent(cid)}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
        { source: "pubchem" },
      ),
      requestJson<SynonymsResponse>(
        `${BASE}/cid/${encodeURIComponent(cid)}/synonyms/JSON`,
        { source: "pubchem" },
      ),
    ]);
    const properties =
      propsResult.status === "fulfilled"
        ? (propsResult.value.PropertyTable?.Properties ?? [])
        : [];
    const synonymEntries =
      synonymsResult.status === "fulfilled"
        ? (synonymsResult.value.InformationList?.Information ?? [])
        : [];
    const numCid = Number(cid);
    const synonyms = (synonymEntries.find((entry) => entry.CID === numCid)?.Synonym ?? [])
      .slice(0, 40);
    reference = buildPubChemReference(
      numCid,
      propertyOf(properties, numCid),
      synonyms.length > 0 ? synonyms : (stub.synonyms ?? []),
    );
  } catch {
    // Keep the stub; properties/synonyms will simply be unavailable.
  }

  const sections: MedicalReferenceDetail["sections"] = [];

  if (reference.properties) {
    const rows = Object.entries(reference.properties)
      .filter(([, value]) => Boolean(value?.trim()))
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    if (rows) sections.push({ heading: "Properties", body: rows });
  }
  if (reference.synonyms && reference.synonyms.length > 0) {
    sections.push({
      heading: "Synonyms",
      body: reference.synonyms.slice(0, 40).join(", "),
    });
  }

  return { reference, sections };
}
