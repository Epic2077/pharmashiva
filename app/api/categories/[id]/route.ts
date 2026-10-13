import type { NextRequest } from "next/server";
import {
  getCategoryById,
  getCategoryPath,
  getSubcategories,
} from "@/lib/supabase";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/** GET /api/categories/[id] — one category with its path and subcategories. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const category = await getCategoryById(id);
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    const [path, subcategories] = await Promise.all([
      getCategoryPath(id),
      getSubcategories(id),
    ]);

    return Response.json({ category, path, subcategories });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
