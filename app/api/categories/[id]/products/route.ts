import type { NextRequest } from "next/server";
import { searchProducts } from "@/lib/darukade/service";
import {
  getCategoryTree,
  findCategoryNodeById,
  requestForCategoryNode,
} from "@/lib/darukade/categories";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * GET /api/categories/[id]/products
 * Products in a category (and its subcategories), live from Darukade.
 * Optional `q` narrows the listing with the source's own search.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20,
    100,
  );

  try {
    const tree = await getCategoryTree();
    const node = findCategoryNodeById(tree, id);
    const categoryRequest = node ? requestForCategoryNode(node) : undefined;
    if (!node || !categoryRequest || categoryRequest.kind === "unsupported") {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    const outcome = await searchProducts(q, {
      limit,
      detailLimit: 8,
      budgetMs: 6_000,
      category: categoryRequest,
    });
    return Response.json({
      products: outcome.hits,
      meta: {
        total: outcome.totalProducts,
        enriched: outcome.enriched,
        timings: outcome.timings,
        category: { id: String(node.id), title: node.title },
      },
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
