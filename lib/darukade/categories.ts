/**
 * Darukade category hierarchy, verified against the source's own data.
 *
 * The site exposes its category tree in `headerFooterData.header.menus` on
 * every server-rendered page (homepage included). This module fetches that
 * tree, validates it at runtime, caches it in memory, and maps product URLs
 * onto category nodes so product cards can carry a source-backed category
 * label without a per-product detail request.
 */

import { DARUKADE_ORIGIN } from "./config.ts";
import { extractNextData } from "./next-data.ts";
import { fetchDarukade } from "./http.ts";
import type {
  CategoryRequest,
  DarukadeCategoryNode,
  RawMenuNode,
} from "./types.ts";
import { validateHeaderMenus } from "./validate.ts";

export type { CategoryRequest, DarukadeCategoryNode };

/** How long the category tree stays fresh in memory. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Retry cooldown when a fetch failed, so a broken upstream isn't hammered. */
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
/** Cap the tree depth kept in memory (top + three levels is plenty). */
const MAX_DEPTH = 3;

interface TreeCache {
  nodes: DarukadeCategoryNode[];
  fetchedAt: number;
}

let cache: TreeCache | null = null;
let inflight: Promise<DarukadeCategoryNode[]> | null = null;
let lastFailureAt = 0;

/** Flatten a tree into a list (depth-first). */
function flatten(nodes: DarukadeCategoryNode[]): DarukadeCategoryNode[] {
  const out: DarukadeCategoryNode[] = [];
  const visit = (node: DarukadeCategoryNode): void => {
    out.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

/** Convert raw menu nodes into normalized category nodes. */
function normalizeMenuNodes(
  raw: RawMenuNode[],
  parentId: number | null = null,
  depth = 0,
): DarukadeCategoryNode[] {
  if (depth > MAX_DEPTH) return [];
  return raw.flatMap((entry) => {
    const children = normalizeMenuNodes(
      entry.childs ?? [],
      entry.id ?? null,
      depth + 1,
    );
    return [
      {
        id: entry.id ?? null,
        title: entry.title?.trim() ?? "",
        url: entry.url ?? "",
        parentId,
        depth,
        children,
      },
    ];
  });
}

async function fetchTree(): Promise<DarukadeCategoryNode[]> {
  const response = await fetchDarukade("/");
  const data = extractNextData(response.text, response.url);
  const rawHeader = data.props.pageProps.headerFooterData;
  const menus = validateHeaderMenus(rawHeader);
  const nodes = normalizeMenuNodes(menus);
  if (nodes.length === 0) {
    throw new Error("Darukade homepage exposes no category menus");
  }
  cache = { nodes, fetchedAt: Date.now() };
  return nodes;
}

/** Warm (or refresh) the cache from any page's `headerFooterData` payload. */
export function warmCategoryTreeFromPageProps(pageProps: unknown): void {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
  const menus = validateHeaderMenus(pageProps);
  if (menus.length === 0) return;
  const nodes = normalizeMenuNodes(menus);
  if (nodes.length > 0) cache = { nodes, fetchedAt: Date.now() };
}

/** Synchronous read of the cached tree (may be empty when cold). */
export function getCachedCategoryTree(): DarukadeCategoryNode[] {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) return [];
  return cache.nodes;
}

/** Fetch the verified category tree, cached in memory. */
export async function getCategoryTree(): Promise<DarukadeCategoryNode[]> {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return cache!.nodes;
  if (inflight) return inflight;
  if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS && cache) {
    // Serve the stale tree instead of hammering a failing upstream.
    return cache.nodes;
  }
  inflight = fetchTree()
    .catch((error) => {
      lastFailureAt = Date.now();
      if (cache) return cache.nodes; // stale-but-real beats nothing
      throw error;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Flattened (parent-then-children) copy of the cached tree. */
export function listCategoryNodes(
  tree: DarukadeCategoryNode[],
): DarukadeCategoryNode[] {
  return flatten(tree);
}

/**
 * Vocabulary for the interpretation prompt: the verified category titles from
 * the source's own navigation. Darukade exposes no global ingredient list, so
 * `ingredients` stays empty rather than being guessed.
 */
export function categoryVocabulary(
  tree: DarukadeCategoryNode[],
  limit = 60,
): { categories: string[]; ingredients: string[] } {
  return {
    categories: listCategoryNodes(tree)
      .map((node) => node.title)
      .slice(0, limit),
    ingredients: [],
  };
}

/** Find a category node by its source menu id. */
export function findCategoryNodeById(
  tree: DarukadeCategoryNode[],
  id: number | string,
): DarukadeCategoryNode | null {
  const value = String(id);
  return (
    flatten(tree).find(
      (node) => node.id !== null && String(node.id) === value,
    ) ?? null
  );
}

/** The numeric category id a node's URL points at (`c=` param or `-123` suffix). */
export function categoryIdOfUrl(url: string): number | null {
  const match = url.match(/[?&]c=(\d+)/);
  if (match) return Number.parseInt(match[1]!, 10);
  const trailing = url.match(/-(\d+)(?:[/?#]|$)/);
  if (trailing) return Number.parseInt(trailing[1]!, 10);
  return null;
}

/**
 * True when the node's URL is a brand filter (`?b=`). The source's navigation
 * nests brand entries under categories, but they are not categories.
 */
export function isBrandFilterNode(node: DarukadeCategoryNode): boolean {
  try {
    return new URL(node.url, DARUKADE_ORIGIN).searchParams.has("b");
  } catch {
    return false;
  }
}

/**
 * True when a tree node can be offered as a subcategory chip: its request is
 * supported by the source and it is not a brand-filter entry.
 */
export function isSelectableSubcategory(node: DarukadeCategoryNode): boolean {
  return (
    requestForCategoryNode(node).kind !== "unsupported" &&
    !isBrandFilterNode(node)
  );
}

/**
 * Map a product URL onto the deepest category node whose own URL is a path
 * prefix of the product URL (e.g. product `/products/supplement-creatine-171/x-10517`
 * matches node `/products/supplement-creatine-171`). Falls back to matching the
 * trailing numeric category id.
 */
export function findCategoryForProductUrl(
  tree: DarukadeCategoryNode[],
  productUrl: string,
): DarukadeCategoryNode | null {
  if (!productUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(productUrl, DARUKADE_ORIGIN);
  } catch {
    return null;
  }
  const productPath = parsed.pathname.replace(/\/+$/, "");

  let best: DarukadeCategoryNode | null = null;
  let bestLength = 0;
  for (const node of flatten(tree)) {
    if (!node.url.startsWith("/products/")) continue;
    let nodePath: string;
    try {
      nodePath = new URL(node.url, DARUKADE_ORIGIN).pathname.replace(
        /\/+$/,
        "",
      );
    } catch {
      continue;
    }
    if (
      nodePath &&
      (productPath === nodePath || productPath.startsWith(nodePath + "/")) &&
      nodePath.length > bestLength
    ) {
      best = node;
      bestLength = nodePath.length;
    }
  }
  if (best) return best;

  // Fallback: trailing category id in the product path segment.
  const id = categoryIdOfUrl(productPath);
  if (id !== null) {
    const byId = flatten(tree).find(
      (node) => node.id !== null && node.id === id,
    );
    if (byId) return byId;
  }
  return null;
}

/**
 * Translate a category node into the source request it supports. Only request
 * kinds verified against the live site are used: `c` top-level ids, category
 * slug paths, and `g`/`ty` filter parameters all combine with `w` search.
 * `tl` refinements are ignored by the source during search and are reported
 * back via `droppedRefinement` instead of being silently kept.
 */
export function requestForCategoryNode(
  node: DarukadeCategoryNode,
): CategoryRequest {
  let parsed: URL;
  try {
    parsed = new URL(node.url, DARUKADE_ORIGIN);
  } catch {
    return { kind: "unsupported" };
  }
  // Only /products pages are product categories. Other navigation entries
  // (/jamalzadeh, /mag, …) are pages, not categories.
  const isProductsPage = /^\/products(\/|$)/.test(parsed.pathname);
  const path = isProductsPage
    ? parsed.pathname.replace(/^\/products\/?/, "").replace(/\/+$/, "")
    : "";
  const c = parsed.searchParams.get("c");
  const g = parsed.searchParams.get("g");
  const ty = parsed.searchParams.get("ty");
  const tl = parsed.searchParams.get("tl");

  const extra: Record<string, string> = {};
  if (g) extra.g = g;
  if (ty) extra.ty = ty;
  const dropped = tl ? "tl" : null;

  if (path) {
    return {
      kind: "path",
      path,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
      droppedRefinement: dropped,
    };
  }
  if (c) {
    return {
      kind: "category",
      categoryId: c,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
      droppedRefinement: dropped,
    };
  }
  if (g || ty) {
    return { kind: "filters", extra, droppedRefinement: dropped };
  }
  return { kind: "unsupported" };
}
