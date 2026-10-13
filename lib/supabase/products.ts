import { getSupabaseClient } from "./server";
import { getCategorySubtreeIds } from "./categories";
import { fetchAllRows, fetchByIn, IN_CHUNK } from "./paginate";
import type {
  CategoryRef,
  IngredientRef,
  Product,
  ProductDetails,
  ProductSearchHit,
  ProductSearchResult,
} from "@/types/database";

/** Embedded select joining ingredients and leaf categories in one query. */
const PRODUCT_DETAILS_SELECT = [
  "*",
  "product_ingredients(amount, unit, form, raw_name, ingredient:ingredients(canonical_name, persian_name, aliases))",
  "product_categories(category:categories(id, name, slug, parent_id, parent_name, breadcrumbs))",
].join(", ");

interface ProductDetailsRow extends Product {
  product_ingredients: Array<{
    amount: number | null;
    unit: string | null;
    form: string | null;
    raw_name: string | null;
    ingredient: {
      canonical_name: string;
      persian_name: string | null;
      aliases: string[] | null;
    } | null;
  }> | null;
  product_categories: Array<{ category: CategoryRef | null }> | null;
}

function mapProductDetails(row: ProductDetailsRow): ProductDetails {
  const ingredients: IngredientRef[] = (row.product_ingredients ?? []).map(
    (pi) => ({
      name: pi.ingredient?.canonical_name ?? pi.raw_name ?? "",
      name_en: pi.ingredient?.canonical_name ?? null,
      name_fa: pi.ingredient?.persian_name ?? null,
      amount: pi.amount,
      unit: pi.unit,
      form: pi.form,
      raw_name: pi.raw_name,
    }),
  );

  const categories: CategoryRef[] = (row.product_categories ?? [])
    .map((link) => link.category)
    .filter((category): category is CategoryRef => category !== null);

  // Strip the embedded relation arrays so the result only has the flat product
  // fields plus the two mapped arrays above.
  const product = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== "product_ingredients" && key !== "product_categories",
    ),
  ) as unknown as Product;

  return { ...product, ingredients, categories };
}

/** Fetch full product rows (with ingredients + categories) by id. */
async function fetchProductDetails(
  ids: string[],
  limit?: number,
): Promise<ProductDetails[]> {
  if (ids.length === 0) return [];
  const sb = getSupabaseClient();
  const rows: ProductDetailsRow[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    if (limit !== undefined && rows.length >= limit) break;
    const chunk = ids.slice(i, i + IN_CHUNK);
    let query = sb
      .from("products")
      .select(PRODUCT_DETAILS_SELECT)
      .in("id", chunk);
    if (limit !== undefined) query = query.limit(limit - rows.length);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as ProductDetailsRow[]));
  }
  return rows.map(mapProductDetails);
}

/** Ranked + fuzzy product search via the `search_products` RPC. */
export async function searchProducts(
  query: string,
  limit = 10,
): Promise<ProductSearchResult[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("search_products", {
    search_query: query,
    result_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductSearchResult[];
}

export async function getProductById(
  id: string,
): Promise<ProductDetails | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("products")
    .select(PRODUCT_DETAILS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapProductDetails(data as unknown as ProductDetailsRow) : null;
}

export async function getProductBySku(
  sku: string,
): Promise<ProductDetails | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("products")
    .select(PRODUCT_DETAILS_SELECT)
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapProductDetails(data as unknown as ProductDetailsRow) : null;
}

export async function getProductByBarcode(
  barcode: string,
): Promise<ProductDetails | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("products")
    .select(PRODUCT_DETAILS_SELECT)
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapProductDetails(data as unknown as ProductDetailsRow) : null;
}

export interface GetProductsByCategoryOptions {
  limit?: number;
  /** Include products in subcategories too (default `true`). */
  includeSubcategories?: boolean;
}

export async function getProductsByCategory(
  categoryId: string,
  options: GetProductsByCategoryOptions = {},
): Promise<ProductDetails[]> {
  const { limit = 50, includeSubcategories = true } = options;
  const categoryIds = includeSubcategories
    ? await getCategorySubtreeIds(categoryId)
    : [categoryId];

  const sb = getSupabaseClient();
  const links = await fetchByIn<{ product_id: string }>(
    categoryIds,
    (chunk, from, to) =>
      sb
        .from("product_categories")
        .select("product_id")
        .in("category_id", chunk)
        .range(from, to),
  );

  const productIds = Array.from(new Set(links.map((link) => link.product_id)));
  return fetchProductDetails(productIds, limit);
}

export async function getProductsByIngredient(
  ingredient: string,
  limit = 50,
): Promise<ProductDetails[]> {
  const sb = getSupabaseClient();
  const pattern = `%${ingredient}%`;

  // 1. Matching ingredient ids (English or Persian).
  const ingredients = await fetchAllRows<{ id: string }>((from, to) =>
    sb
      .from("ingredients")
      .select("id")
      .or(`canonical_name.ilike.${pattern},persian_name.ilike.${pattern}`)
      .range(from, to),
  );
  const ingredientIds = ingredients.map((row) => row.id);
  if (ingredientIds.length === 0) return [];

  // 2. Products linked to those ingredients.
  const links = await fetchByIn<{ product_id: string }>(
    ingredientIds,
    (chunk, from, to) =>
      sb
        .from("product_ingredients")
        .select("product_id")
        .in("ingredient_id", chunk)
        .range(from, to),
  );
  const productIds = Array.from(new Set(links.map((link) => link.product_id)));
  if (productIds.length === 0) return [];

  // 3. Fetch the products.
  return fetchProductDetails(productIds, limit);
}

export async function getProductsByIds(
  ids: string[],
): Promise<ProductDetails[]> {
  return fetchProductDetails(ids);
}

/**
 * Top ingredient names by how many products contain them — powers the
 * "Popular Searches" chips.
 */
export async function getPopularSearchTerms(limit = 8): Promise<string[]> {
  const sb = getSupabaseClient();
  const [ingredientsResult, linksResult] = await Promise.all([
    sb.from("ingredients").select("id, canonical_name"),
    sb.from("product_ingredients").select("ingredient_id"),
  ]);
  if (ingredientsResult.error) throw new Error(ingredientsResult.error.message);
  if (linksResult.error) throw new Error(linksResult.error.message);

  const nameById = new Map<string, string>();
  for (const row of (ingredientsResult.data ?? []) as Array<{
    id: string;
    canonical_name: string;
  }>) {
    nameById.set(row.id, row.canonical_name);
  }

  const counts = new Map<string, number>();
  for (const row of (linksResult.data ?? []) as Array<{
    ingredient_id: string;
  }>) {
    counts.set(row.ingredient_id, (counts.get(row.ingredient_id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([ingredientId, count]) => ({
      name: nameById.get(ingredientId),
      count,
    }))
    .filter((entry): entry is { name: string; count: number } =>
      Boolean(entry.name),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.name);
}

/** Ranked search that returns full product rows. */
export async function searchCatalog(
  query: string,
  limit = 20,
): Promise<ProductSearchHit[]> {
  const results = await searchProducts(query, limit);
  const products = await getProductsByIds(results.map((result) => result.id));
  const productById = new Map(products.map((product) => [product.id, product]));
  return results.flatMap((result) => {
    const product = productById.get(result.id);
    return product ? [{ rank: result.rank, product }] : [];
  });
}
