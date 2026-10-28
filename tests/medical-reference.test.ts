/**
 * Medical Reference unit + integration tests (no live network).
 *
 * Provider parsers are exercised against fixture payloads, the deterministic
 * pieces (normalization, aliases, citation, ranking, context building) are
 * pinned, and the unified search is run against a mocked global `fetch` to
 * prove that a failed source yields partial results instead of failing the
 * whole search.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { normalizeQuery, isPersianScript } from "../lib/medical-reference/normalization.ts";
import { resolveAlias } from "../lib/medical-reference/aliases.ts";
import { rankReferences } from "../lib/medical-reference/ranking.ts";
import {
  citationLabel,
  citationLine,
  citationForPrompt,
} from "../lib/medical-reference/citation.ts";
import {
  medicalContextForPrompt,
  searchMedicalReferences,
  sourcesForFilter,
  stubReference,
} from "../lib/medical-reference/search.ts";
import { parseMedlinePlusXml } from "../lib/medical-reference/providers/medlineplus.ts";
import { mapESummaryToReference } from "../lib/medical-reference/providers/pubmed.ts";
import { mapDailyMedSummary } from "../lib/medical-reference/providers/dailymed.ts";
import { mapRxNormProperty } from "../lib/medical-reference/providers/rxnorm.ts";
import { buildPubChemReference } from "../lib/medical-reference/providers/pubchem.ts";
import { clearMedicalReferenceCache } from "../lib/medical-reference/http.ts";
import type { MedicalReference } from "../lib/medical-reference/types.ts";

/* ── Fixtures ─────────────────────────────────────────────────── */

const MEDLINE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nlmSearchResult>
  <count>1</count>
  <list>
    <document rank="1" url="https://medlineplus.gov/diabetes.html">
      <content name="title">&lt;span class="qt0"&gt;Diabetes&lt;/span&gt;</content>
      <content name="organizationName">National Library of Medicine</content>
      <content name="FullSummary">&lt;p&gt;Diabetes is a disease in which your blood glucose is too high.&lt;/p&gt;</content>
      <content name="snippet">Diabetes is a disease...</content>
    </document>
  </list>
</nlmSearchResult>`;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

/* ── Normalization / aliases ──────────────────────────────────── */

test("normalizeQuery collapses whitespace, case and Persian character drift", () => {
  assert.equal(normalizeQuery("  Diabetes   Mellitus  "), "diabetes mellitus");
  assert.equal(isPersianScript("سردرد"), true);
  assert.equal(isPersianScript("headache"), false);
});

test("resolveAlias maps a curated Persian term to English", () => {
  assert.equal(resolveAlias("سردرد"), "headache");
  assert.equal(resolveAlias("فشار خون بالا"), "high blood pressure");
  assert.equal(resolveAlias("امگا ۳"), "omega-3");
  assert.equal(resolveAlias("headache"), null);
});

/* ── Citation / ranking / context ─────────────────────────────── */

const sampleReference: MedicalReference = {
  source: "medlineplus",
  sourceLabel: "MedlinePlus",
  externalId: "diabetes",
  recordType: "medical_topic",
  title: "Diabetes",
  summary: "A disease in which blood glucose is too high.",
  url: "https://medlineplus.gov/diabetes.html",
  updatedAt: null,
  language: "en",
};

test("citationLabel and citationLine are numbered and attributed", () => {
  assert.equal(citationLabel(0), "[1]");
  assert.equal(citationLine(sampleReference, 0), "[1] Diabetes — MedlinePlus");
});

test("citationForPrompt embeds the source url so the model can never invent one", () => {
  const line = citationForPrompt(sampleReference, 0);
  assert.ok(line.includes("https://medlineplus.gov/diabetes.html"));
  assert.ok(line.includes("[1]"));
});

test("rankReferences prioritizes patient-facing sources and title matches", () => {
  const research: MedicalReference = {
    ...sampleReference,
    source: "pubmed",
    sourceLabel: "PubMed",
    recordType: "research",
    title: "Unrelated paper",
    summary: "something else",
  };
  const ranked = rankReferences([research, sampleReference], "diabetes");
  assert.equal(ranked[0]!.source, "medlineplus");
});

test("medicalContextForPrompt respects the character budget", () => {
  const context = medicalContextForPrompt([sampleReference], 500);
  assert.ok(context.length <= 500);
  assert.ok(context.includes("[1]"));
  assert.ok(context.includes("https://medlineplus.gov/diabetes.html"));

  // A budget smaller than the first line yields no partial/broken line.
  assert.equal(medicalContextForPrompt([sampleReference], 10), "");
});

/* ── Provider parsers ─────────────────────────────────────────── */

test("parseMedlinePlusXml extracts title, summary and url", () => {
  const records = parseMedlinePlusXml(MEDLINE_XML);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.title, "Diabetes");
  assert.ok(records[0]!.summary!.includes("blood glucose"));
  assert.equal(records[0]!.url, "https://medlineplus.gov/diabetes.html");
  assert.equal(records[0]!.sourceLabel, "MedlinePlus");
});

test("mapESummaryToReference detects abstract availability from attributes", () => {
  const withAbstract = mapESummaryToReference({
    uid: "1",
    title: "A Study",
    source: "J Med",
    pubdate: "2026 Jan",
    authors: [{ name: "Doe J" }],
    articleids: [
      { idtype: "pubmed", value: "1" },
      { idtype: "doi", value: "10.1/x" },
    ],
    attributes: ["Has Abstract"],
  });
  assert.equal(withAbstract?.abstractAvailable, true);
  assert.equal(withAbstract?.journal, "J Med");
  assert.equal(withAbstract?.authors?.[0], "Doe J");

  const without = mapESummaryToReference({ uid: "2", title: "Another", attributes: [] });
  assert.equal(without?.abstractAvailable, false);
});

test("mapDailyMedSummary links to the original label", () => {
  const record = mapDailyMedSummary({
    setid: "abc-123",
    title: "ASPIRIN TABLET",
    published_date: "Oct 26, 2026",
  });
  assert.equal(record?.recordType, "drug_label");
  assert.ok(record?.url.includes("setid=abc-123"));
  assert.equal(record?.updatedAt, "Oct 26, 2026");
});

test("mapRxNormProperty distinguishes ingredients from names", () => {
  const ingredient = mapRxNormProperty({ rxcui: "1191", name: "aspirin", tty: "IN" });
  assert.equal(ingredient?.recordType, "ingredient");
  const brand = mapRxNormProperty({ rxcui: "1", name: "Bayer Aspirin", tty: "BN" });
  assert.equal(brand?.recordType, "terminology");
});

test("buildPubChemReference preserves chemical properties, not clinical claims", () => {
  const record = buildPubChemReference(
    2244,
    {
      CID: 2244,
      IUPACName: "2-acetyloxybenzoic acid",
      MolecularFormula: "C9H8O4",
      MolecularWeight: "180.16",
    },
    ["aspirin", "Acetylsalicylic acid"],
  );
  assert.equal(record.externalId, "2244");
  assert.equal(record.properties?.MolecularFormula, "C9H8O4");
  assert.ok(record.url.includes("2244"));
});

/* ── Source routing / stubs ───────────────────────────────────── */

test("sourcesForFilter routes each filter to its providers", () => {
  assert.deepEqual(sourcesForFilter("research"), ["pubmed"]);
  assert.deepEqual(sourcesForFilter("definitions"), ["medlineplus"]);
  assert.ok(sourcesForFilter("all").length >= 4);
});

test("stubReference builds a canonical link per source", () => {
  const stub = stubReference("pubmed", "42950143", "A Study");
  assert.equal(stub.url, "https://pubmed.ncbi.nlm.nih.gov/42950143/");
  assert.equal(stub.recordType, "research");
});

/* ── Unified search (mocked fetch) ────────────────────────────── */

test("searchMedicalReferences returns parsed MedlinePlus results", async () => {
  clearMedicalReferenceCache();
  const restore = mockFetch(async (url) => {
    if (url.includes("wsearch.nlm.nih.gov")) {
      return new Response(MEDLINE_XML, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const result = await searchMedicalReferences({
      query: "diabetes",
      filter: "definitions",
    });
    assert.equal(result.partial, false);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0]!.title, "Diabetes");
  } finally {
    restore();
  }
});

test("a failed source yields partial results, never a failed search", async () => {
  clearMedicalReferenceCache();
  const restore = mockFetch(async (url) => {
    if (url.includes("wsearch.nlm.nih.gov")) {
      return new Response(MEDLINE_XML, { status: 200 });
    }
    if (url.includes("eutils.ncbi.nlm.nih.gov")) {
      throw new Error("down");
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const result = await searchMedicalReferences({
      query: "diabetes",
      filter: "conditions",
    });
    assert.equal(result.partial, true);
    assert.ok(result.results.length >= 1);
    assert.deepEqual(
      result.sources.filter((source) => !source.ok).map((source) => source.source),
      ["pubmed"],
    );
  } finally {
    restore();
  }
});

test("empty query returns an empty result without calling sources", async () => {
  const result = await searchMedicalReferences({ query: "   " });
  assert.equal(result.results.length, 0);
  assert.equal(result.partial, false);
});

