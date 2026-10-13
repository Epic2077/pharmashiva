import type { NextRequest } from "next/server";
import { getProductsByCategory } from "@/lib/supabase";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * GET /api/categories/[id]/products
 * All products in a category, including its subcategories.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50,
    200,
  );

  try {
    return Response.json({
      products: await getProductsByCategory(id, { limit }),
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
