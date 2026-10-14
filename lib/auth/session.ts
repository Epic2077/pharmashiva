import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

/**
 * Read the signed-in user from the session cookie.
 *
 * Uses `getClaims()`, which validates the JWT (locally when the project uses
 * asymmetric signing keys, otherwise against the Auth server) without trusting
 * the cookie payload directly. Returns `null` for guests.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;

  const claims = data?.claims as Record<string, unknown> | undefined;
  if (!claims || typeof claims.sub !== "string") return null;

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: typeof meta.full_name === "string" ? meta.full_name : null,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
}

/** Like `getSessionUser`, but for places that must have a user. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
