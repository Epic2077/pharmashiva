/**
 * Extraction of the embedded Next.js payload (`__NEXT_DATA__`) from SSR HTML.
 *
 * darukade.com is a Next.js app: every server-rendered page embeds its page
 * props in a single `<script id="__NEXT_DATA__" type="application/json">` tag.
 * Reading that JSON is far more stable than scraping rendered markup, and it
 * gives us the same data the site itself renders.
 *
 * Next.js escapes `<` inside the payload as `\u003c`, so a non-greedy match up
 * to the closing `</script>` is safe.
 */

import { ParseError } from "./errors.ts";
import { fetchDarukade, type FetchOptions } from "./http.ts";

const NEXT_DATA_RE =
  /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;
const BUILD_ID_RE = /"buildId"\s*:\s*"([^"]+)"/;

export interface NextData {
  buildId: string | null;
  page: string | null;
  props: {
    pageProps: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/** Parse the `__NEXT_DATA__` JSON blob out of an HTML document. */
export function extractNextData(html: string, url?: string): NextData {
  const match = html.match(NEXT_DATA_RE);
  if (!match) {
    throw new ParseError("No __NEXT_DATA__ script found in HTML", url);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!);
  } catch (error) {
    throw new ParseError(
      `Malformed __NEXT_DATA__ JSON: ${(error as Error).message}`,
      url,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new ParseError("__NEXT_DATA__ was not an object", url);
  }
  const data = parsed as Record<string, unknown>;
  const props = (data.props ?? {}) as Record<string, unknown>;
  return {
    buildId: typeof data.buildId === "string" ? data.buildId : null,
    page: typeof data.page === "string" ? data.page : null,
    props: {
      ...props,
      pageProps: (props.pageProps ?? {}) as Record<string, unknown>,
    },
  };
}

/**
 * Best-effort build ID discovery straight from HTML (regex), used as a fallback
 * when the JSON payload cannot be parsed but the ID is still present.
 */
export function extractBuildId(html: string): string | null {
  const match = html.match(BUILD_ID_RE);
  return match?.[1] ?? null;
}

/**
 * Fetch a Darukade page and return both the parsed Next.js data and the raw
 * HTML (the raw document is handy for debugging and content hashing).
 */
export async function fetchNextData(
  pathOrUrl: string,
  options: FetchOptions = {},
): Promise<{ data: NextData; html: string; url: string; notModified: boolean }> {
  const response = await fetchDarukade(pathOrUrl, options);
  if (response.status === 304) {
    return {
      data: { buildId: null, page: null, props: { pageProps: {} } },
      html: "",
      url: response.url,
      notModified: true,
    };
  }
  const data = extractNextData(response.text, response.url);
  return { data, html: response.text, url: response.url, notModified: false };
}

/**
 * Discover the current Next.js build ID from the homepage.
 *
 * The `/_next/data/{buildId}/...json` endpoints need this value, but because we
 * read SSR HTML directly we only need it for the optional JSON shortcut. It is
 * therefore allowed to fail softly.
 */
export async function discoverBuildId(options: FetchOptions = {}): Promise<string | null> {
  const response = await fetchDarukade("/", options);
  try {
    return extractNextData(response.text, response.url).buildId;
  } catch {
    return extractBuildId(response.text);
  }
}
