/**
 * Darukade connector configuration.
 *
 * Everything that tunes how the connector talks to darukade.com lives here so
 * the request layer never hard-codes secrets, hosts or limits. Values can be
 * overridden with environment variables (see `.env.example`) without touching
 * code, which keeps the sync script safe to run in CI or a container.
 */

/** Canonical origin. All request URLs are built from this and nothing else. */
export const DARUKADE_ORIGIN = "https://darukade.com";

/** Hosts the connector is allowed to request. Anything else is rejected. */
export const DARUKADE_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "darukade.com",
  "www.darukade.com",
]);

/**
 * A normal browser UA. The site serves the same SSR HTML to this UA as to a
 * real browser, and identifying ourselves honestly avoids being treated as a
 * bot while keeping requests cache-friendly.
 */
export const DARUKADE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Products per listing page, as reported by the source. */
export const LISTING_PAGE_SIZE = 24;

export interface DarukadeConfig {
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Retries for transient failures (network, 429, 5xx). */
  retries: number;
  /** Maximum in-flight requests during enrichment. */
  concurrency: number;
  /** Minimum spacing between request starts, in milliseconds (politeness). */
  minIntervalMs: number;
  /** Safety valve so a runaway sync can never exceed this many requests. */
  maxRequestsPerRun: number;
  /** Provider key stored on `products.provider`. */
  provider: string;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Resolve connector settings from the environment with sensible defaults. */
export function getDarukadeConfig(): DarukadeConfig {
  return {
    timeoutMs: readInt("DARUKADE_TIMEOUT_MS", 20_000),
    retries: readInt("DARUKADE_RETRIES", 3),
    concurrency: Math.min(Math.max(readInt("DARUKADE_CONCURRENCY", 4), 1), 16),
    minIntervalMs: readInt("DARUKADE_MIN_INTERVAL_MS", 150),
    maxRequestsPerRun: readInt("DARUKADE_MAX_REQUESTS", 20_000),
    provider: "darukade",
  };
}
