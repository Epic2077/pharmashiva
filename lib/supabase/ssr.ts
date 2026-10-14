import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAuthEnv } from "./env";

/**
 * Cookie-backed Supabase client for server code (server components, server
 * actions, route handlers).
 *
 * This carries the *user session*, so it is the right client for auth and for
 * anything that should be filtered by RLS. Catalog reads keep using the
 * service-role client in `./server`.
 *
 * `setAll` can be called while rendering a server component, where Next does
 * not allow writing cookies; that is expected and safe to swallow because the
 * proxy refreshes the session on every request.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseAuthEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — the proxy handles refresh.
        }
      },
    },
  });
}
