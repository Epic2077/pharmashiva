/**
 * MedlinePlus Web Service adapter.
 *
 * Endpoint: https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=…&retmax=…
 * Returns XML (`<nlmSearchResult><list><document url="…"><content name="…">`).
 *
 * We parse titles, summaries/snippets, and the canonical URL, and always link
 * back to the original MedlinePlus page. The service returns patient-friendly
 * topic data only — it is not a complete clinical article, and we never assume
 * it is. Data is updated daily Tue–Sat; results are cached 24h.
 */

import { requestText } from "../http";
import { stripHtml, truncateText } from "../html";
import { childrenNamed, parseXml, type XmlNode } from "../xml";
import type { MedicalReference, MedicalReferenceDetail } from "../types";

const SEARCH_URL = "https://wsearch.nlm.nih.gov/ws/query";

export function medlineplusSearchUrl(query: string, retmax: number): string {
  const params = new URLSearchParams({
    db: "healthTopics",
    term: query,
    retmax: String(retmax),
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

/** Read a `<content name="…">` field from a MedlinePlus `<document>`. */
function contentText(doc: XmlNode, name: string): string {
  for (const child of doc.children) {
    if (child.name === "content" && child.attributes["name"] === name) {
      return child.text;
    }
  }
  return "";
}

/** Parse the MedlinePlus Web Service XML response into reference records. */
export function parseMedlinePlusXml(xml: string): MedicalReference[] {
  const root = parseXml(xml);
  if (!root) return [];
  const list = childrenNamed(root, "list")[0] ?? root;
  const documents = childrenNamed(list, "document");
  const out: MedicalReference[] = [];

  for (const doc of documents) {
    const url = (doc.attributes["url"] ?? "").trim();
    const title = stripHtml(contentText(doc, "title"));
    const fullSummary = stripHtml(contentText(doc, "FullSummary"));
    const snippet = stripHtml(contentText(doc, "snippet"));
    if (!title) continue;

    out.push({
      source: "medlineplus",
      sourceLabel: "MedlinePlus",
      externalId: url.split("/").filter(Boolean).pop() ?? title,
      recordType: "medical_topic",
      title,
      summary:
        truncateText(fullSummary || snippet || "", 400) || null,
      url,
      updatedAt: null,
      language: "en",
    });
  }
  return out;
}

export async function searchMedlinePlus(
  query: string,
  limit = 8,
): Promise<MedicalReference[]> {
  const url = medlineplusSearchUrl(query, Math.min(limit, 10));
  const xml = await requestText(url, { source: "medlineplus" });
  return parseMedlinePlusXml(xml).slice(0, limit);
}

/**
 * MedlinePlus health-topic pages are full HTML, not a structured API. We do
 * not scrape them; the detail view shows the summary already retrieved plus a
 * link to the original page, and never claims to hold the complete article.
 */
export async function getMedlinePlusDetail(
  _externalId: string,
  reference: MedicalReference,
): Promise<MedicalReferenceDetail | null> {
  const sections =
    reference.summary && reference.summary.trim()
      ? [{ heading: "Summary", body: reference.summary }]
      : [];
  return { reference, sections };
}
