#!/usr/bin/env node
/**
 * Darukade catalog sync CLI.
 *
 * Run directly with Node's TypeScript loader:
 *
 *   node scripts/darukade-sync.ts discover --query creatine --pages 2
 *   node scripts/darukade-sync.ts enrich --limit 100 --concurrency 4
 *   node scripts/darukade-sync.ts product --id 10517
 *   node scripts/darukade-sync.ts product --url "/products/...-10517"
 *   node scripts/darukade-sync.ts related --id 10517
 *   node scripts/darukade-sync.ts full --query vitamin-c --pages 3
 *   node scripts/darukade-sync.ts status
 *   node scripts/darukade-sync.ts stats
 *
 * Add `--dry-run` to fetch + normalize without writing anything. Ingestion is
 * idempotent, so re-running is always safe. Progress is recorded in
 * `darukade_sync_runs` and the durable `darukade_sync_queue`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DarukadeClient,
  DarukadeRepository,
  emptyStats,
  mapWithConcurrency,
  getDarukadeConfig,
  type NormalizedProductDetail,
  type SyncStats,
} from "../lib/darukade/index.ts";

type Mode = "discover" | "enrich" | "product" | "related" | "full" | "status" | "stats";

interface Args {
  mode: Mode;
  query?: string;
  category?: string;
  id?: number;
  url?: string;
  pages: number;
  limit: number;
  concurrency: number;
  dryRun: boolean;
  related: boolean;
  onlyMissing: boolean;
}

function parseArgs(argv: string[]): Args {
  const [mode = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, true);
    }
  }
  const num = (key: string, fallback: number): number => {
    const value = flags.get(key);
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  };
  const modeValue = mode as Mode;
  const valid: Mode[] = [
    "discover",
    "enrich",
    "product",
    "related",
    "full",
    "status",
    "stats",
  ];
  return {
    mode: valid.includes(modeValue) ? modeValue : "stats",
    query: typeof flags.get("query") === "string" ? String(flags.get("query")) : undefined,
    category:
      typeof flags.get("category") === "string" ? String(flags.get("category")) : undefined,
    id: flags.has("id") ? num("id", NaN) : undefined,
    url: typeof flags.get("url") === "string" ? String(flags.get("url")) : undefined,
    pages: num("pages", 1),
    limit: num("limit", 50),
    concurrency: num("concurrency", getDarukadeConfig().concurrency),
    dryRun: flags.get("dry-run") === true,
    related: flags.get("related") !== false && flags.get("no-related") !== true,
    onlyMissing: flags.get("only-missing") === true,
  };
}

function loadEnv(): void {
  // Node 20.12+/22 can load a .env file natively.
  try {
    const loader = (process as unknown as { loadEnvFile?: (path?: string) => void })
      .loadEnvFile;
    loader?.();
  } catch {
    // No .env file — rely on the real environment.
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env`,
    );
  }
  return value;
}

function log(message: string): void {
  console.log(`[darukade] ${message}`);
}

async function runDiscover(
  client: DarukadeClient,
  repo: DarukadeRepository,
  args: Args,
  stats: SyncStats,
): Promise<void> {
  if (!args.query && !args.category) {
    throw new Error("discover requires --query <term> or --category <id>");
  }
  const source = args.query
    ? { search: args.query }
    : { category: args.category! };

  for await (const listing of client.iterateListings(source, args.pages)) {
    stats.pages += 1;
    log(
      `page ${listing.page}/${listing.totalPages} — ${listing.products.length} products (${listing.totalProducts} total)`,
    );
    if (args.dryRun) {
      for (const product of listing.products.slice(0, 5)) {
        log(`  · ${product.sourceProductId} ${product.nameFa} — ${product.price ?? "?"} تومان / ${product.availability}`);
      }
      continue;
    }
    for (const product of listing.products) {
      await repo.upsertProduct(product, { enriched: false });
      stats.productsUpserted += 1;
    }
    await repo.enqueue(
      listing.products.map((product) => ({
        sourceProductId: product.sourceProductId,
        productUrl: product.productUrl,
      })),
    );
  }
}

async function enrichOne(
  repo: DarukadeRepository,
  client: DarukadeClient,
  url: string,
  related: boolean,
  dryRun: boolean,
): Promise<{ id: number; name: string; unchanged: boolean }> {
  const { product } = await client.fetchProduct(url);
  if (related) {
    try {
      const relationships = await client.fetchRelated(product.sourceProductId);
      if (relationships.length > 0) product.relationships = relationships;
    } catch (error) {
      log(`  ! related fetch failed for ${product.sourceProductId}: ${(error as Error).message}`);
    }
  }
  if (dryRun) {
    return { id: product.sourceProductId, name: product.nameFa, unchanged: false };
  }
  const { unchanged } = await repo.upsertProduct(product, { enriched: true });
  return { id: product.sourceProductId, name: product.nameFa, unchanged };
}

async function runEnrich(
  client: DarukadeClient,
  repo: DarukadeRepository,
  args: Args,
  stats: SyncStats,
): Promise<void> {
  const claimed = await repo.claimQueued(args.limit);
  log(`draining ${claimed.length} queued product(s), concurrency ${args.concurrency}`);
  let index = 0;
  await mapWithConcurrency(claimed, args.concurrency, async (item) => {
    index += 1;
    const prefix = `[${index}/${claimed.length}] ${item.sourceProductId}`;
    try {
      const result = await enrichOne(repo, client, item.productUrl, args.related, args.dryRun);
      if (result.unchanged) {
        stats.productsUnchanged += 1;
        log(`${prefix} = unchanged`);
      } else {
        stats.productsUpserted += 1;
        log(`${prefix} ✓ ${result.name}`);
      }
      if (!args.dryRun) await repo.markQueued(item.sourceProductId, "done", item.attempts + 1);
    } catch (error) {
      stats.failures += 1;
      const message = (error as Error).message;
      log(`${prefix} ✗ ${message}`);
      if (!args.dryRun) {
        await repo.markQueued(item.sourceProductId, "failed", item.attempts + 1, message);
      }
    }
  });
}

async function resolveUrl(
  repo: DarukadeRepository,
  sb: SupabaseClient,
  args: Args,
): Promise<string> {
  if (args.url) return args.url;
  if (!args.id) throw new Error("product/related requires --id <sourceId> or --url <path>");
  const { data, error } = await sb
    .from("products")
    .select("canonical_url")
    .eq("source_product_id", args.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.canonical_url) {
    throw new Error(
      `No known URL for source id ${args.id}; run discover first or pass --url`,
    );
  }
  return data.canonical_url as string;
}

async function runSingle(
  client: DarukadeClient,
  repo: DarukadeRepository,
  sb: SupabaseClient,
  args: Args,
  stats: SyncStats,
): Promise<void> {
  const url = await resolveUrl(repo, sb, args);
  const result = await enrichOne(repo, client, url, args.related, args.dryRun);
  if (result.unchanged) stats.productsUnchanged += 1;
  else stats.productsUpserted += 1;
  log(`synced ${result.id} — ${result.name}`);

  if (args.mode === "related" && args.related) {
    const relationships = await client.fetchRelated(result.id);
    log(`related products: ${relationships.length}`);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === "stats" || args.mode === "status") {
    const sb = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const repo = new DarukadeRepository(sb);
    if (args.mode === "stats") {
      console.log(JSON.stringify(await repo.catalogStats(), null, 2));
    } else {
      console.log(JSON.stringify(await repo.queueCounts(), null, 2));
    }
    return;
  }

  const controller = new AbortController();
  const onSignal = () => {
    log("interrupt received — finishing in-flight work then stopping");
    controller.abort();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  const sb = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repo = new DarukadeRepository(sb);
  const client = new DarukadeClient({
    signal: controller.signal,
    concurrency: args.concurrency,
  });

  const stats = emptyStats();
  const runId = args.dryRun
    ? null
    : await repo.startRun(args.mode, {
        query: args.query ?? null,
        category: args.category ?? null,
        dryRun: args.dryRun,
      });

  try {
    if (args.mode === "discover") {
      await runDiscover(client, repo, args, stats);
    } else if (args.mode === "enrich") {
      await runEnrich(client, repo, args, stats);
    } else if (args.mode === "full") {
      await runDiscover(client, repo, args, stats);
      await runEnrich(client, repo, { ...args, limit: args.limit }, stats);
    } else {
      await runSingle(client, repo, sb, args, stats);
    }
    if (runId) await repo.finishRun(runId, "completed", stats as never);
    log(`done — ${JSON.stringify(stats)}`);
  } catch (error) {
    if (runId) {
      await repo.finishRun(runId, "failed", stats as never, (error as Error).message);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(`[darukade] fatal: ${(error as Error).message}`);
  process.exitCode = 1;
});
