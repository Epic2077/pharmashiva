import type { NextRequest } from "next/server";
import {
  getCategoryTree,
  getSubcategories,
  getTopLevelCategories,
} from "@/lib/supabase";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * Categories.
 *
 *   GET /api/categories                  → top-level categories
 *   GET /api/categories?parent=<id>      → direct subcategories
 *   GET /api/categories?tree=true        → full nested tree
 *   GET /api/categories?source=<id>      → scope by source (optional)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const source = params.get("source") ?? undefined;
  const parent = params.get("parent");
  const tree = params.get("tree") === "true";

  try {
    if (tree) return Response.json({ tree: await getCategoryTree(source) });
    if (parent)
      return Response.json({ categories: await getSubcategories(parent) });
    return Response.json({ categories: await getTopLevelCategories(source) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
