import type { NextRequest } from "next/server";
import { getProductById } from "@/lib/supabase";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/** GET /api/products/[id] — full product with ingredients + categories. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const product = await getProductById(id);
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    return Response.json({ product });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
