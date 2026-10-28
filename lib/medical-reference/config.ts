/**
 * Server-only configuration for the Medical Reference integration.
 *
 * All five sources are free and public. NCBI (PubMed E-utilities) asks for a
 * `tool` and `email` so its staff can reach us if a request is misbehaving —
 * these are overridable via environment variables and are never shipped to the
 * browser. Nothing here requires a paid key.
 */

import type { MedicalSource } from "./types";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function envInt(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Contact information passed to NCBI E-utilities (policy requirement). */
export const MEDREF_NCBI_EMAIL =
  env("MEDREF_NCBI_EMAIL") || "medical-reference@pharmashiva.local";
export const MEDREF_NCBI_TOOL = env("MEDREF_NCBI_TOOL") || "pharmashiva";

/** Per-request timeout (ms). A slow source must never stall a search. */
export const MEDREF_TIMEOUT_MS = envInt("MEDREF_TIMEOUT_MS", 8_000);

/** Retries for transient failures (429 / 5xx / network). */
export const MEDREF_RETRIES = envInt("MEDREF_RETRIES", 2);

/** Hard cap on how many records one source returns for one search. */
export const MEDREF_MAX_PER_SOURCE = envInt("MEDREF_MAX_PER_SOURCE", 8);

/** Hard cap on total results returned from a unified search. */
export const MEDREF_MAX_TOTAL = 24;

/** Maximum characters of retrieved context passed to the AI model. */
export const MEDREF_AI_CONTEXT_CHARS = envInt("MEDREF_AI_CONTEXT_CHARS", 5_000);

/**
 * Cache TTL per source, aligned with each source's data freshness and published
 * caching guidance (MedlinePlus explicitly recommends 12–24h caching).
 */
export const CACHE_TTL_MS: Record<MedicalSource, number> = {
  medlineplus: 24 * 60 * 60 * 1000,
  pubmed: 12 * 60 * 60 * 1000,
  dailymed: 24 * 60 * 60 * 1000,
  rxnorm: 7 * 24 * 60 * 60 * 1000,
  pubchem: 7 * 24 * 60 * 60 * 1000,
};

/** Minimum spacing between requests to the same host (politeness). */
export const RATE_LIMIT_MIN_INTERVAL_MS: Record<MedicalSource, number> = {
  medlineplus: 700,
  pubmed: 360,
  dailymed: 250,
  rxnorm: 250,
  pubchem: 250,
};
