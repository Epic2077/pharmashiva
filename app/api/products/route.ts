import type { NextRequest } from "next/server";
import {
  getProductByBarcode,
  getProductBySku,
  getProductsByCategory,
  getProductsByIngredient,
  searchProducts,
} from "@/lib/supabase";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * Product search / lookup.
 *
 *   GET /api/products?q=vitamin c
 *   GET /api/products?sku=D-28993
 *   GET /api/products?barcode=6260000000000
 *   GET /api/products?category=<categoryId>
 *   GET /api/products?ingredient=iron
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const sku = params.get("sku")?.trim();
  const barcode = params.get("barcode")?.trim();
  const category = params.get("category")?.trim();
  const ingredient = params.get("ingredient")?.trim();
  const limit = Math.min(Number(params.get("limit") ?? 10) || 10, 100);

  try {
    if (q) return Response.json({ results: await searchProducts(q, limit) });
    if (sku) return Response.json({ product: await getProductBySku(sku) });
    if (barcode)
      return Response.json({ product: await getProductByBarcode(barcode) });
    if (category) {
      return Response.json({
        products: await getProductsByCategory(category, { limit }),
      });
    }
    if (ingredient) {
      return Response.json({
        products: await getProductsByIngredient(ingredient, limit),
      });
    }

    return Response.json(
      { error: "Provide one of: q, sku, barcode, category, ingredient" },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
