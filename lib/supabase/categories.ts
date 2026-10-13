import { getSupabaseClient } from "./server";
import type { Category, CategoryNode, CategoryWithCount } from "@/types/database";

/**
 * Category data access.
 *
 * `categories` is a self-referencing tree: `parent_id IS NULL` marks a root,
 * and `breadcrumbs` stores the root→leaf path as `string[]`.
 */

export async function getCategoryById(id: string): Promise<Category | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Category | null) ?? null;
}

export async function getAllCategories(sourceId?: string): Promise<Category[]> {
  const sb = getSupabaseClient();
  let query = sb
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (sourceId) query = query.eq("source_id", sourceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

/** Top-level (root) categories: `parent_id IS NULL`. */
export async function getTopLevelCategories(
  sourceId?: string,
): Promise<Category[]> {
  const sb = getSupabaseClient();
  let query = sb
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("name", { ascending: true });
  if (sourceId) query = query.eq("source_id", sourceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

/** Direct children of a category. */
export async function getSubcategories(parentId: string): Promise<Category[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("parent_id", parentId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

/** Root→leaf path (names) for a category, from the stored `breadcrumbs`. */
export async function getCategoryPath(categoryId: string): Promise<string[]> {
  const category = await getCategoryById(categoryId);
  return category?.breadcrumbs ?? [];
}

/** Build a nested tree from a flat category list. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const category of categories) {
    byId.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const category of categories) {
    const node = byId.get(category.id);
    if (!node) continue;
    const parent = category.parent_id
      ? byId.get(category.parent_id)
      : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Full category tree (nested). */
export async function getCategoryTree(
  sourceId?: string,
): Promise<CategoryNode[]> {
  return buildCategoryTree(await getAllCategories(sourceId));
}

/**
 * All category ids in a subtree, including the category itself.
 * Used to resolve "products in a category and all its subcategories".
 */
export async function getCategorySubtreeIds(
  categoryId: string,
): Promise<string[]> {
  const categories = await getAllCategories();

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parent_id) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parent_id, siblings);
  }

  const ids: string[] = [];
  const stack = [categoryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    ids.push(current);
    for (const child of childrenByParent.get(current) ?? []) stack.push(child);
  }
  return ids;
}

/** Top-level categories, each with the number of products in its subtree. */
export async function getTopLevelCategoriesWithProductCounts(
  sourceId?: string,
): Promise<CategoryWithCount[]> {
  const categories = await getAllCategories(sourceId);
  const topLevel = categories.filter((category) => category.parent_id === null);
  if (topLevel.length === 0) return [];

  // Map every category to its root ancestor so product links can be
  // attributed to a top-level category in a single pass.
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parent_id) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parent_id, siblings);
  }

  const rootByCategory = new Map<string, string>();
  for (const root of topLevel) {
    const stack = [root.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      rootByCategory.set(current, root.id);
      for (const child of childrenByParent.get(current) ?? []) stack.push(child);
    }
  }

  const sb = getSupabaseClient();
  const { data: links, error } = await sb
    .from("product_categories")
    .select("product_id, category_id");
  if (error) throw new Error(error.message);

  const productIdsByRoot = new Map<string, Set<string>>();
  for (const link of (links ?? []) as Array<{
    product_id: string;
    category_id: string;
  }>) {
    const rootId = rootByCategory.get(link.category_id);
    if (!rootId) continue;
    const productIds = productIdsByRoot.get(rootId) ?? new Set<string>();
    productIds.add(link.product_id);
    productIdsByRoot.set(rootId, productIds);
  }

  return topLevel.map((category) => ({
    ...category,
    productCount: productIdsByRoot.get(category.id)?.size ?? 0,
  }));
}
