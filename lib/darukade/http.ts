/**
 * HTTP layer for the Darukade connector.
 *
 * Responsibilities:
 *   * build and validate URLs (allow-listed host only),
 *   * apply a timeout to every request,
 *   * retry transient failures (network errors, 429, 5xx) with exponential
 *     backoff + jitter, and honour `Retry-After`,
 *   * cap concurrency and pace requests so we never hammer the site.
 *
 * It deliberately returns the raw body as text; callers decide how to parse it.
 */

import {
  DARUKADE_ALLOWED_HOSTS,
  DARUKADE_ORIGIN,
  DARUKADE_USER_AGENT,
  getDarukadeConfig,
} from "./config.ts";
import { BlockedUrlError, HttpError } from "./errors.ts";

export interface FetchResult {
  url: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  text: string;
}

export interface FetchOptions {
  /** Accept header. */
  accept?: string;
  /** Extra headers merged on top of the defaults. */
  headers?: Record<string, string>;
  /** Per-request timeout override. */
  timeoutMs?: number;
  /** Retry count override. */
  retries?: number;
  /** Conditional request support: pass a previously stored ETag. */
  etag?: string | null;
  /** Pass to treat a 304 as a cache hit. */
  lastModified?: string | null;
  /** Abort signal from the caller (e.g. Ctrl-C). */
  signal?: AbortSignal | undefined;
}

/** Sleep that resolves early when the caller aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Build an absolute, allow-listed Darukade URL. Accepts either a full URL or a
 * site-relative path such as `/products?w=creatine`.
 */
export function darukadeUrl(pathOrUrl: string): string {
  const url = new URL(pathOrUrl, DARUKADE_ORIGIN);
  if (url.protocol !== "https:" || !DARUKADE_ALLOWED_HOSTS.has(url.hostname)) {
    throw new BlockedUrlError(url.href);
  }
  return url.href;
}

/** Guard for values that reach the connector from user/source input. */
export function assertAllowedUrl(url: string): void {
  darukadeUrl(url);
}

/** Exponential backoff with full jitter, capped at 30s. */
function backoffDelay(attempt: number): number {
  const base = Math.min(1_000 * 2 ** (attempt - 1), 30_000);
  return Math.floor(base / 2 + Math.random() * (base / 2));
}

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 60_000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 60_000));
  return null;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Paces outgoing requests: at most `concurrency` in flight and at least
 * `minIntervalMs` between request *starts*.
 */
export class RequestPacer {
  private active = 0;
  private lastStart = 0;
  private queue: Array<() => void> = [];
  private readonly concurrency: number;
  private readonly minIntervalMs: number;

  constructor(concurrency: number, minIntervalMs: number) {
    this.concurrency = concurrency;
    this.minIntervalMs = minIntervalMs;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1;
      return this.pace();
    }
    return new Promise((resolve) => {
      this.queue.push(async () => {
        this.active += 1;
        await this.pace();
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) void next();
  }

  private async pace(): Promise<void> {
    const wait = this.lastStart + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastStart = Date.now();
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Fetch a Darukade URL as text, with timeout + retries + backoff.
 *
 * Throws `BlockedUrlError` for non-Darukade URLs and `HttpError` once retries
 * are exhausted on a retryable/non-ok response.
 */
export async function fetchDarukade(
  pathOrUrl: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const config = getDarukadeConfig();
  const url = darukadeUrl(pathOrUrl);
  const retries = options.retries ?? config.retries;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    if (options.signal?.aborted) throw new Error("Aborted");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onOuterAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        "User-Agent": DARUKADE_USER_AGENT,
        Accept:
          options.accept ??
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        ...options.headers,
      };
      if (options.etag) headers["If-None-Match"] = options.etag;
      if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;

      const response = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });

      const status = response.status;
      if (status === 304) {
        return {
          url,
          status,
          ok: true,
          contentType: response.headers.get("content-type"),
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          text: "",
        };
      }

      if (RETRYABLE_STATUS.has(status) && attempt <= retries) {
        const wait =
          retryAfterMs(response.headers.get("retry-after")) ?? backoffDelay(attempt);
        lastError = new HttpError(url, status);
        await sleep(wait, options.signal);
        continue;
      }

      if (!response.ok) {
        throw new HttpError(url, status);
      }

      const text = await response.text();
      return {
        url,
        status,
        ok: true,
        contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        text,
      };
    } catch (error) {
      // A caller-triggered abort must not be retried.
      if (options.signal?.aborted) throw error;
      const retryable = isAbortError(error) || error instanceof TypeError;
      if (retryable && attempt <= retries) {
        lastError = error;
        await sleep(backoffDelay(attempt), options.signal);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Request to ${url} failed`);
}

/** Run `worker` over `items` with a bounded number of concurrent workers. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  const pool = Array.from(
    { length: Math.min(Math.max(concurrency, 1), items.length || 1) },
    () => consume(),
  );
  await Promise.all(pool);
  return results;
}
