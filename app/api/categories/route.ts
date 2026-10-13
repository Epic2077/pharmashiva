import type { NextRequest } from "next/server";
import {
  getAllCategories,
  getCategoryTree,
  getSubcategories,
  getTopLevelCategories,
  searchCategories,
} from "@/lib/supabase";
import { getServerLanguage, localizeCategoryName } from "@/lib/i18n-server";
import { translateEnToFa } from "@/lib/translate";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * Categories.
 *
 *   GET /api/categories                  → top-level categories
 *   GET /api/categories?q=vitamin        → search category names
 *   GET /api/categories?parent=<id>      → direct subcategories
 *   GET /api/categories?tree=true        → full nested tree
 *   GET /api/categories?source=<id>      → scope by source (optional)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const source = params.get("source") ?? undefined;
  const query = params.get("q")?.trim();
  const parent = params.get("parent");
  const tree = params.get("tree") === "true";
  const limit = Math.min(Number(params.get("limit") ?? 24) || 24, 50);

  try {
    if (query) {
      const language = await getServerLanguage();
      let matches = await searchCategories(query, limit);

      // Stored names are Persian, so retry an English query in Farsi.
      if (matches.length === 0 && language === "en") {
        const translated = await translateEnToFa(query);
        if (translated !== query) {
          matches = await searchCategories(translated, limit);
        }
      }

      const allCategories = await getAllCategories();
      const byId = new Map(
        allCategories.map((category) => [category.id, category]),
      );
      const categories = await Promise.all(
        matches.map(async (category) => {
          const parentCategory = category.parent_id
            ? byId.get(category.parent_id)
            : undefined;
          return {
            id: category.id,
            title: await localizeCategoryName(category, language),
            parent: parentCategory
              ? await localizeCategoryName(parentCategory, language)
              : null,
          };
        }),
      );

      return Response.json({ categories });
    }

    if (tree) return Response.json({ tree: await getCategoryTree(source) });
    if (parent)
      return Response.json({ categories: await getSubcategories(parent) });
    return Response.json({ categories: await getTopLevelCategories(source) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
