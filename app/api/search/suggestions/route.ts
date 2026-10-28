import type { NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/darukade/service";

/**
 * Autocomplete proxy for the search input. Keeps the Darukade suggestions API
 * call server-side so the browser never makes a cross-origin request.
 *
 *   GET /api/search/suggestions?w=pro
 */
export async function GET(request: NextRequest) {
  const w = request.nextUrl.searchParams.get("w")?.trim() ?? "";
  const suggestions = await getSearchSuggestions(w);
  return Response.json(suggestions);
}
