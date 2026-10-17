import type { NextRequest } from "next/server";
import {
  searchProducts,
  searchProductsByIngredient,
  type SearchOutcome,
} from "@/lib/darukade/service";
import {
  getCategoryTree,
  findCategoryNodeById,
  requestForCategoryNode,
} from "@/lib/darukade/categories";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function metaFor(outcome: SearchOutcome) {
  return {
    total: outcome.totalProducts,
    enriched: outcome.enriched,
    timings: outcome.timings,
  };
}

/**
 * Product search / lookup against the live Darukade source.
 *
 *   GET /api/products?q=vitamin c
 *   GET /api/products?q=creatine&category=171
 *   GET /api/products?ingredient=iron
 *   GET /api/products?category=4          (browse a category)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const ingredient = params.get("ingredient")?.trim();
  const categoryParam = params.get("category")?.trim();
  const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
  const detailLimit = Math.min(Number(params.get("detail") ?? 8) || 8, 40);
  const budgetMs = Math.min(
    Number(params.get("budget") ?? 6000) || 6000,
    30_000,
  );

  try {
    if (ingredient) {
      const outcome = await searchProductsByIngredient(ingredient, {
        limit,
        detailLimit: Math.min(detailLimit, 12),
        budgetMs: Math.max(budgetMs, 8000),
      });
      return Response.json({
        results: outcome.hits,
        meta: {
          ...metaFor(outcome),
          checked: outcome.checked,
          matched: outcome.matched,
          unverified: outcome.unverified,
        },
      });
    }

    if (categoryParam) {
      const tree = await getCategoryTree();
      const node = findCategoryNodeById(tree, categoryParam);
      const request = node ? requestForCategoryNode(node) : undefined;
      if (!request || request.kind === "unsupported") {
        return Response.json(
          { error: `Unknown category: ${categoryParam}` },
          { status: 404 },
        );
      }
      const outcome = await searchProducts(q, {
        limit,
        detailLimit,
        budgetMs,
        category: request,
      });
      return Response.json({
        results: outcome.hits,
        meta: {
          ...metaFor(outcome),
          category: {
            id: String(node?.id ?? categoryParam),
            title: node?.title ?? categoryParam,
          },
        },
      });
    }

    if (q) {
      const outcome = await searchProducts(q, { limit, detailLimit, budgetMs });
      return Response.json({ results: outcome.hits, meta: metaFor(outcome) });
    }

    return Response.json(
      { error: "Provide one of: q, ingredient, category" },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
