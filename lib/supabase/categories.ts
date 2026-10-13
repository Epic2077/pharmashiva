import { getSupabaseClient } from "./server";
import { fetchAllRows } from "./paginate";
import type {
  Category,
  CategoryNode,
  CategoryWithCount,
} from "@/types/database";

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

/** Case-insensitive category name search (stored names are Persian). */
export async function searchCategories(
  query: string,
  limit = 24,
): Promise<Category[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(limit);
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

/** Ancestor chain for a category, ordered root → leaf (inclusive). */
export async function getCategoryAncestors(
  categoryId: string,
): Promise<Category[]> {
  const categories = await getAllCategories();
  const byId = new Map(categories.map((category) => [category.id, category]));

  const chain: Category[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return chain.reverse();
}

/**
 * Direct children of a category (or top-level categories when `parentId` is
 * `null`), each with the number of products in its subtree.
 */
export async function getChildCategoriesWithProductCounts(
  parentId: string | null,
  sourceId?: string,
): Promise<CategoryWithCount[]> {
  const categories = await getAllCategories(sourceId);
  const children = categories.filter((category) =>
    parentId === null
      ? category.parent_id === null
      : category.parent_id === parentId,
  );
  if (children.length === 0) return [];

  // Map every category to the direct child it rolls up into, so product links
  // can be attributed to a child in a single pass.
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parent_id) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parent_id, siblings);
  }

  const childByCategory = new Map<string, string>();
  for (const child of children) {
    const stack = [child.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      childByCategory.set(current, child.id);
      for (const descendant of childrenByParent.get(current) ?? []) {
        stack.push(descendant);
      }
    }
  }

  const sb = getSupabaseClient();
  const links = await fetchAllRows<{
    product_id: string;
    category_id: string;
  }>((from, to) =>
    sb
      .from("product_categories")
      .select("product_id, category_id")
      .range(from, to),
  );

  const productIdsByChild = new Map<string, Set<string>>();
  for (const link of links) {
    const childId = childByCategory.get(link.category_id);
    if (!childId) continue;
    const productIds = productIdsByChild.get(childId) ?? new Set<string>();
    productIds.add(link.product_id);
    productIdsByChild.set(childId, productIds);
  }

  return children.map((category) => ({
    ...category,
    productCount: productIdsByChild.get(category.id)?.size ?? 0,
  }));
}

/** Top-level categories, each with the number of products in its subtree. */
export async function getTopLevelCategoriesWithProductCounts(
  sourceId?: string,
): Promise<CategoryWithCount[]> {
  return getChildCategoriesWithProductCounts(null, sourceId);
}
