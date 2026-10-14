import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/ssr";

/**
 * OAuth callback: exchanges the `code` Supabase sends back for a session cookie.
 * Only used by the Google flow (email sign-in does not redirect here).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/home";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const failure = new URL("/auth/login", origin);
  failure.searchParams.set("error", "auth");
  return NextResponse.redirect(failure);
}
