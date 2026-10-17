import type { NextRequest } from "next/server";
import {
  getCategoryTree,
  findCategoryNodeById,
  listCategoryNodes,
  isBrandFilterNode,
} from "@/lib/darukade/categories";
import { isLanguageCode } from "@/lib/i18n";
import { localizeTitlesBounded } from "@/lib/i18n-server";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * GET /api/categories/[id] — one category from Darukade's verified navigation
 * tree, with its path and subcategories. No catalog database involved.
 * `?lang=en` adds translated display labels (falls back to Persian).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const langParam = request.nextUrl.searchParams.get("lang");
  const language = isLanguageCode(langParam) ? langParam : "en";

  try {
    const tree = await getCategoryTree();
    const category = findCategoryNodeById(tree, id);
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    // Ancestor path, closest first.
    const byId = new Map(
      listCategoryNodes(tree).map((node) => [node.id, node] as const),
    );
    const path: string[] = [];
    let parentId = category.parentId;
    while (parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent) break;
      path.unshift(parent.title);
      parentId = parent.parentId;
    }

    const children = category.children.filter(
      (child) => !isBrandFilterNode(child),
    );
    const [categoryLabel, pathLabels, childLabels] = await Promise.all([
      localizeTitlesBounded([category.title], language),
      localizeTitlesBounded(path, language),
      localizeTitlesBounded(
        children.map((child) => child.title),
        language,
      ),
    ]);

    return Response.json({
      category: {
        id: category.id !== null ? String(category.id) : category.url,
        title: category.title,
        label: categoryLabel[0] ?? category.title,
        url: category.url,
        parentId: category.parentId !== null ? String(category.parentId) : null,
      },
      path,
      pathLabels,
      subcategories: children.map((child, index) => ({
        id: child.id !== null ? String(child.id) : child.url,
        title: child.title,
        label: childLabels[index] ?? child.title,
        url: child.url,
      })),
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
