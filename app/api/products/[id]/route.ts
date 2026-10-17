import type { NextRequest } from "next/server";
import {
  getProductBySourceId,
  getProductByUrl,
  getRelatedProductsFor,
} from "@/lib/darukade/service";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * GET /api/products/[id] — full product with ingredients + categories.
 *
 * The Darukade source has no ID-only product URL, so requests should carry
 * `?url=` (the canonical product URL from a listing). Without it the service
 * falls back to a recently learned id→URL mapping.
 *
 *   GET /api/products/10517?url=%2Fproducts%2F...%2Fpowder-creatine-monohydrate-10517
 *   GET /api/products/10517?url=...&related=1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = request.nextUrl.searchParams.get("url") || undefined;
  const includeRelated = request.nextUrl.searchParams.get("related") === "1";

  try {
    const product = url
      ? await getProductByUrl(url)
      : await getProductBySourceId(id);
    if (!product) {
      return Response.json(
        {
          error: url
            ? "Product could not be retrieved from Darukade"
            : "Product URL is unknown. The source has no ID-only product page; open the product from a search result instead.",
        },
        { status: 404 },
      );
    }

    const related = includeRelated ? await getRelatedProductsFor(id) : [];
    return Response.json({ product, related });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
