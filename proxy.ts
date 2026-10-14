import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAuthEnv, isSupabaseAuthConfigured } from "@/lib/supabase/env";

/**
 * Next 16 renamed `middleware` to `proxy`. This refreshes the Supabase session
 * cookie on every matched request and guards the app routes.
 *
 * Guarding here is a convenience/UX layer only: every server action and route
 * handler re-verifies the user itself (see the Next 16 proxy docs).
 */

/** App routes that require a signed-in user. */
const PROTECTED_PREFIXES = ["/home", "/setting"];
/** Signed-out-only routes: bounce signed-in users away from these. */
const AUTH_ENTRY_PATHS = ["/auth/login", "/auth/signup"];

function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Without auth env we cannot tell who is signed in; fail closed on protected
  // routes rather than silently letting everyone in.
  if (!isSupabaseAuthConfigured()) {
    if (requiresAuth(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("error", "auth");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { url, anonKey } = getSupabaseAuthEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Validates the JWT (and refreshes the session if it is close to expiry).
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isAuthed && requiresAuth(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthed && AUTH_ENTRY_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/home",
    "/home/:path*",
    "/setting",
    "/setting/:path*",
    "/auth/login",
    "/auth/signup",
  ],
};
