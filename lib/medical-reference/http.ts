/**
 * Shared request layer for the medical reference providers.
 *
 * Every external call is made server-side and goes through here so the whole
 * integration gets timeouts, bounded retries, per-host rate limiting and an
 * in-memory cache for free. A failed or slow source is reported as an error to
 * the caller (which treats it as a partial result), never as fabricated data.
 */

import type { MedicalSource } from "./types";
import {
  CACHE_TTL_MS,
  MEDREF_RETRIES,
  MEDREF_TIMEOUT_MS,
  RATE_LIMIT_MIN_INTERVAL_MS,
} from "./config";

const cache = new Map<string, { text: string; ts: number }>();
const lastRequestAt = new Map<string, number>();
const MAX_CACHE_ENTRIES = 500;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Clear the caches (used by tests to avoid cross-test state). */
export function clearMedicalReferenceCache(): void {
  cache.clear();
  lastRequestAt.clear();
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  ttlMs?: number;
  headers?: Record<string, string>;
  source?: MedicalSource;
}

async function fetchOnce(url: string, options: RequestOptions): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? MEDREF_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: controller.signal,
      cache: "no-store",
    });
    // 429 and 5xx are transient; anything else non-2xx is a real failure.
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`upstream ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch text with caching, rate limiting and retries. Throws only after all
 * retries are exhausted; the caller decides how to degrade.
 */
export async function requestText(
  url: string,
  options: RequestOptions = {},
): Promise<string> {
  const ttlMs =
    options.ttlMs ?? (options.source ? CACHE_TTL_MS[options.source] : 0);

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < ttlMs) return cached.text;

  const host = hostOf(url);
  const minInterval = options.source
    ? RATE_LIMIT_MIN_INTERVAL_MS[options.source]
    : 0;
  const now = Date.now();
  const last = lastRequestAt.get(host) ?? 0;
  const wait = Math.max(0, last + minInterval - now);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());

  const retries = options.retries ?? MEDREF_RETRIES;
  let lastError: unknown = new Error("request failed");
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const text = await fetchOnce(url, options);
      if (ttlMs > 0) {
        cache.set(url, { text, ts: Date.now() });
        if (cache.size > MAX_CACHE_ENTRIES) {
          const first = cache.keys().next().value;
          if (first !== undefined) cache.delete(first);
        }
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("request failed");
}

export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const text = await requestText(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  return JSON.parse(text) as T;
}
