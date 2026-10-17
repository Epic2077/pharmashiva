/**
 * Persistence for the Darukade catalog.
 *
 * Takes an injected Supabase client (service-role in the CLI, the app's
 * server client elsewhere) so the same code path is used everywhere. Every
 * write is an idempotent upsert keyed on stable source identifiers:
 *
 *   products              (provider, source_product_id)
 *   product_variants      (product_id, source_variant_id)
 *   categories            (source_id, name)  + source_category_id
 *   ingredients           (canonical_name)
 *   product_ingredients   (product_id, ingredient_id)
 *   product_relationships (product_id, related_source_product_id, relationship)
 *
 * Two safety rules are enforced here:
 *   1. A listing (summary) upsert only touches the fields a listing actually
 *      knows, so re-discovering a product never erases richer detail from a
 *      previous full-page sync — and null/empty values never overwrite real
 *      ones.
 *   2. An enriched upsert whose content hash is unchanged is skipped entirely.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DARUKADE_ORIGIN } from "./config.ts";
import { hashContent } from "./normalize.ts";
import type {
  Json,
  NormalizedCategory,
  NormalizedIngredient,
  NormalizedProductDetail,
  NormalizedProductSummary,
  NormalizedRelationship,
  NormalizedVariant,
} from "./types.ts";

const PROVIDER = "darukade";

/** Columns that must always be present on a `products` write. */
const REQUIRED_PRODUCT_KEYS = new Set([
  "provider",
  "source_id",
  "source_product_id",
  "canonical_url",
  "name",
  "name_fa",
  "sku",
  "currency",
  "availability",
  "synced_at",
]);

/** Drop null/undefined/empty-array values so they never clobber real data. */
function stripEmpty(
  row: Record<string, unknown>,
  keep: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (keep.has(key)) {
      out[key] = value;
      continue;
    }
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export interface UpsertProductOptions {
  /** True when the row comes from a full product page (not just a listing). */
  enriched: boolean;
}

export interface SyncStats {
  productsUpserted: number;
  productsSkipped: number;
  productsUnchanged: number;
  variants: number;
  ingredients: number;
  categories: number;
  relationships: number;
  failures: number;
  pages: number;
}

export function emptyStats(): SyncStats {
  return {
    productsUpserted: 0,
    productsSkipped: 0,
    productsUnchanged: 0,
    variants: 0,
    ingredients: 0,
    categories: 0,
    relationships: 0,
    failures: 0,
    pages: 0,
  };
}

/** Derive the URL slug (`powder-creatine-monohydrate`) from a product URL. */
export function slugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const last = url.split(/[?#]/)[0]!.replace(/\/+$/, "").split("/").pop();
  if (!last) return null;
  const withoutId = last.replace(/-\d+$/, "");
  return withoutId || null;
}

export class DarukadeRepository {
  private sourceId: string | null = null;
  private readonly sb: SupabaseClient;

  constructor(sb: SupabaseClient) {
    this.sb = sb;
  }

  /** Resolve (and cache) the `sources` row for darukade.com. */
  async ensureSource(): Promise<string> {
    if (this.sourceId) return this.sourceId;
    const existing = await this.sb
      .from("sources")
      .select("id")
      .eq("base_url", DARUKADE_ORIGIN)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) {
      this.sourceId = existing.data.id as string;
      return this.sourceId;
    }

    const inserted = await this.sb
      .from("sources")
      .insert({ base_url: DARUKADE_ORIGIN, name: "Darukade", technologies: ["nextjs"] })
      .select("id")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    this.sourceId = inserted.data.id as string;
    return this.sourceId;
  }

  /** Fields every write knows (identity + listing-level columns). */
  private baseRow(
    product: NormalizedProductSummary,
    sourceId: string,
  ): Record<string, unknown> {
    return {
      provider: PROVIDER,
      source_id: sourceId,
      source_product_id: product.sourceProductId,
      master_id: product.sourceProductId,
      canonical_url: product.productUrl,
      slug: slugFromUrl(product.productUrl),
      name: product.nameFa,
      name_fa: product.nameFa,
      brand: product.brand,
      sku: `D-${product.sourceProductId}`,
      price: product.price,
      original_price: product.originalPrice,
      currency: product.currency,
      availability: product.availability,
      rating: product.rating,
      image_urls: product.images,
      primary_image_url: product.image,
      synced_at: new Date().toISOString(),
    };
  }

  /** Full-page fields on top of the base row. */
  private detailRow(
    product: NormalizedProductDetail,
    sourceId: string,
  ): Record<string, unknown> {
    return {
      ...this.baseRow(product, sourceId),
      master_id: product.masterId ?? product.sourceProductId,
      product_code: product.productCode,
      name_en: product.nameEn,
      review_count: product.reviewCount,
      view_count: product.viewCount,
      description: product.description,
      description_html: product.descriptionHtml,
      expert_review: product.expertReviewHtml,
      properties: product.properties,
      characteristics: product.characteristics,
      usage_info: product.usage,
      keep_conditions: product.keepConditions,
      warnings: product.warnings,
      usage_instructions: product.usageInstructions,
      source_category_path: product.categories
        ? (product.categories.map((category) => category.name) as Json)
        : null,
      content_hash: product.contentHash,
    };
  }

  /**
   * Upsert one product. Summary rows patch only listing-level fields (and only
   * set images when the stored row has none); detail rows write everything and
   * are skipped when the content hash is unchanged.
   */
  async upsertProduct(
    product: NormalizedProductSummary | NormalizedProductDetail,
    options: UpsertProductOptions,
  ): Promise<{ productId: string; unchanged: boolean }> {
    const sourceId = await this.ensureSource();
    const existing = await this.sb
      .from("products")
      .select("id, image_urls, content_hash")
      .eq("provider", PROVIDER)
      .eq("source_product_id", product.sourceProductId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    const existingRow = existing.data as
      | { id: string; image_urls: Json; content_hash: string | null }
      | null;

    if (!options.enriched) {
      const patch = stripEmpty(this.baseRow(product, sourceId), REQUIRED_PRODUCT_KEYS);
      if (existingRow) {
        // Never shrink an existing image list back to a single listing image.
        const storedImages = Array.isArray(existingRow.image_urls)
          ? (existingRow.image_urls as unknown[]).filter(Boolean)
          : [];
        if (storedImages.length === 0 && product.images.length > 0) {
          patch.image_urls = product.images;
          patch.primary_image_url = product.image;
        } else {
          delete patch.image_urls;
          delete patch.primary_image_url;
        }
        const updated = await this.sb
          .from("products")
          .update(patch)
          .eq("id", existingRow.id)
          .select("id")
          .single();
        if (updated.error) throw new Error(updated.error.message);
        return { productId: existingRow.id, unchanged: false };
      }
      const inserted = await this.sb
        .from("products")
        .upsert(
          stripEmpty(this.baseRow(product, sourceId), REQUIRED_PRODUCT_KEYS),
          { onConflict: "provider,source_product_id" },
        )
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      return { productId: inserted.data.id as string, unchanged: false };
    }

    // Enriched path.
    const detail = product as NormalizedProductDetail;
    if (existingRow?.content_hash && existingRow.content_hash === detail.contentHash) {
      return { productId: existingRow.id, unchanged: true };
    }
    const row = stripEmpty(this.detailRow(detail, sourceId), REQUIRED_PRODUCT_KEYS);
    const upsert = await this.sb
      .from("products")
      .upsert(row, { onConflict: "provider,source_product_id" })
      .select("id")
      .single();
    if (upsert.error) throw new Error(upsert.error.message);
    const productId = upsert.data.id as string;

    await this.reconcileVariants(productId, detail.variants);
    await this.reconcileIngredients(
      productId,
      detail.ingredients,
      detail.ingredientServing,
    );
    await this.reconcileCategories(productId, detail.categories);
    await this.reconcileRelationships(productId, detail.relationships);
    await this.recordPriceHistory(productId, detail);

    return { productId, unchanged: false };
  }

  /** Upsert + prune variants so the set always matches the source. */
  private async reconcileVariants(
    productId: string,
    variants: NormalizedVariant[],
  ): Promise<void> {
    if (variants.length === 0) return;
    const rows = variants.map((variant) => ({
      product_id: productId,
      source_variant_id: variant.sourceVariantId,
      type_id: variant.typeId,
      title: variant.title,
      product_code: variant.productCode,
      color: variant.color,
      is_master: variant.isMaster,
      is_selected: variant.isSelected,
      original_price: variant.originalPrice,
      price: variant.price,
      discount_percent: variant.discountPercent,
      currency: variant.currency,
      availability: variant.availability,
      stock_count: variant.stockCount,
      max_sell: variant.maxSell,
      expiration: variant.expiration,
      image_urls: variant.images,
    }));
    const { error } = await this.sb
      .from("product_variants")
      .upsert(rows, { onConflict: "product_id,source_variant_id" });
    if (error) throw new Error(error.message);

    const keep = variants.map((variant) => variant.sourceVariantId);
    await this.sb
      .from("product_variants")
      .delete()
      .eq("product_id", productId)
      .not("source_variant_id", "in", `(${keep.join(",")})`);
  }

  /** Upsert ingredients, then reconcile the product↔ingredient links. */
  private async reconcileIngredients(
    productId: string,
    ingredients: NormalizedIngredient[],
    servingBasis: string | null,
  ): Promise<void> {
    if (ingredients.length === 0) return;

    const byCanonical = new Map<
      string,
      { canonical_name: string; persian_name: string | null }
    >();
    for (const ingredient of ingredients) {
      const canonical = ingredient.nameEn ?? ingredient.nameFa ?? ingredient.rawName;
      if (!canonical) continue;
      const existing = byCanonical.get(canonical);
      byCanonical.set(canonical, {
        canonical_name: canonical,
        persian_name: existing?.persian_name ?? ingredient.nameFa ?? null,
      });
    }
    const names = [...byCanonical.keys()];
    if (names.length === 0) return;

    const upsert = await this.sb
      .from("ingredients")
      .upsert([...byCanonical.values()], { onConflict: "canonical_name" })
      .select("id, canonical_name");
    if (upsert.error) throw new Error(upsert.error.message);

    const idByName = new Map(
      (upsert.data ?? []).map((row: { id: string; canonical_name: string }) => [
        row.canonical_name,
        row.id,
      ]),
    );

    const links = ingredients
      .map((ingredient) => {
        const canonical =
          ingredient.nameEn ?? ingredient.nameFa ?? ingredient.rawName;
        const ingredientId = idByName.get(canonical);
        if (!ingredientId) return null;
        return {
          product_id: productId,
          ingredient_id: ingredientId,
          amount: ingredient.amount,
          unit: ingredient.unit,
          raw_name: ingredient.rawName,
          raw_amount: ingredient.rawAmount,
          serving_basis: servingBasis,
          source: PROVIDER,
        };
      })
      .filter((link): link is NonNullable<typeof link> => link !== null);

    if (links.length === 0) return;
    const deduped = new Map(links.map((link) => [link.ingredient_id, link]));
    const { error } = await this.sb
      .from("product_ingredients")
      .upsert([...deduped.values()], { onConflict: "product_id,ingredient_id" });
    if (error) throw new Error(error.message);

    const keep = [...deduped.keys()];
    await this.sb
      .from("product_ingredients")
      .delete()
      .eq("product_id", productId)
      .not("ingredient_id", "in", `(${keep.join(",")})`);
  }

  /**
   * Upsert the category breadcrumb chain (parent → child) and link the product
   * to its leaf category, matching the existing catalog's leaf-only linkage.
   */
  private async reconcileCategories(
    productId: string,
    categories: NormalizedCategory[],
  ): Promise<void> {
    if (categories.length === 0) return;
    const sourceId = await this.ensureSource();

    let parentId: string | null = null;
    const breadcrumbs: string[] = [];
    const ids: string[] = [];

    for (const category of categories) {
      breadcrumbs.push(category.name);
      const row = {
        source_id: sourceId,
        name: category.name,
        slug: slugFromUrl(category.url) ?? null,
        parent_id: parentId,
        parent_name:
          breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null,
        source_url: category.url ? `${DARUKADE_ORIGIN}${category.url}` : DARUKADE_ORIGIN,
        breadcrumbs,
        source_category_id: category.sourceCategoryId,
      };
      const { data, error } = await this.sb
        .from("categories")
        .upsert(row, { onConflict: "source_id,name" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      parentId = data.id as string;
      ids.push(parentId);
    }

    const leafId = ids[ids.length - 1];
    if (!leafId) return;
    const { error } = await this.sb
      .from("product_categories")
      .upsert(
        { product_id: productId, category_id: leafId },
        { onConflict: "product_id,category_id" },
      );
    if (error) throw new Error(error.message);
  }

  /** Upsert source-provided product relationships. */
  private async reconcileRelationships(
    productId: string,
    relationships: NormalizedRelationship[],
  ): Promise<void> {
    if (relationships.length === 0) return;
    const rows = relationships.map((relationship) => ({
      product_id: productId,
      related_source_product_id: relationship.relatedSourceProductId,
      relationship: relationship.kind,
      title: relationship.title,
      url: relationship.url,
      position: relationship.position,
      source: PROVIDER,
    }));
    const { error } = await this.sb
      .from("product_relationships")
      .upsert(rows, {
        onConflict: "product_id,related_source_product_id,relationship",
      });
    if (error) throw new Error(error.message);
  }

  /**
   * Append a price/availability snapshot only when it differs from the latest
   * one, so history stays small and meaningful.
   */
  private async recordPriceHistory(
    productId: string,
    product: NormalizedProductDetail,
  ): Promise<void> {
    const latest = await this.sb
      .from("product_price_history")
      .select("price, availability")
      .eq("product_id", productId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw new Error(latest.error.message);

    const previous = latest.data as
      | { price: number | null; availability: string | null }
      | null;
    const changed =
      !previous ||
      String(previous.price ?? "") !== String(product.price ?? "") ||
      (previous.availability ?? "") !== product.availability;
    if (!changed) return;

    const { error } = await this.sb.from("product_price_history").insert({
      product_id: productId,
      price: product.price,
      original_price: product.originalPrice,
      currency: product.currency,
      availability: product.availability,
    });
    if (error) throw new Error(error.message);
  }

  /** Queue discovered product ids for later enrichment (idempotent). */
  async enqueue(
    entries: Array<{ sourceProductId: number; productUrl: string }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((entry) => ({
      source_product_id: entry.sourceProductId,
      product_url: entry.productUrl,
      status: "pending",
    }));
    const { error } = await this.sb
      .from("darukade_sync_queue")
      .upsert(rows, { onConflict: "source_product_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  /** Claim up to `limit` pending queue rows (ordered, resumable). */
  async claimQueued(
    limit: number,
  ): Promise<Array<{ sourceProductId: number; productUrl: string; attempts: number }>> {
    const { data, error } = await this.sb
      .from("darukade_sync_queue")
      .select("source_product_id, product_url, attempts")
      .eq("status", "pending")
      .order("queued_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(
      (row: { source_product_id: number; product_url: string; attempts: number }) => ({
        sourceProductId: row.source_product_id,
        productUrl: row.product_url,
        attempts: row.attempts,
      }),
    );
  }

  /** Mark a queue row done/failed with the attempt count and last error. */
  async markQueued(
    sourceProductId: number,
    status: "done" | "failed" | "skipped",
    attempts: number,
    lastError?: string | null,
  ): Promise<void> {
    const { error } = await this.sb
      .from("darukade_sync_queue")
      .update({
        status,
        attempts,
        last_error: lastError ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("source_product_id", sourceProductId);
    if (error) throw new Error(error.message);
  }

  async queueCounts(): Promise<Record<string, number>> {
    const { data, error } = await this.sb
      .from("darukade_sync_queue")
      .select("status");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ status: string }>) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  }

  async startRun(
    mode: string,
    options: { query?: string | null; category?: string | null; dryRun: boolean },
  ): Promise<string> {
    const { data, error } = await this.sb
      .from("darukade_sync_runs")
      .insert({
        mode,
        query: options.query ?? null,
        category: options.category ?? null,
        dry_run: options.dryRun,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async finishRun(
    runId: string,
    status: "completed" | "failed" | "cancelled",
    stats: Json,
    error?: string | null,
  ): Promise<void> {
    const { error: updateError } = await this.sb
      .from("darukade_sync_runs")
      .update({
        status,
        stats,
        error: error ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (updateError) throw new Error(updateError.message);
  }

  async catalogStats(): Promise<Json> {
    const { data, error } = await this.sb.rpc("catalog_stats");
    if (error) throw new Error(error.message);
    return data as Json;
  }
}

/** Convenience: stable content hash for a normalized detail (re-exported). */
export { hashContent };
