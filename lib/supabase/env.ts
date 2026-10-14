/**
 * Supabase auth environment (server-only).
 *
 * Auth runs entirely on the server (server actions + proxy refresh), so the
 * project URL and anon key never need to be exposed to the browser. We still
 * accept the `NEXT_PUBLIC_` spellings as a fallback so a deployed environment
 * that follows the usual Supabase convention keeps working.
 */

export interface SupabaseAuthEnv {
  url: string;
  anonKey: string;
}

export function getSupabaseAuthEnv(): SupabaseAuthEnv {
  const url = (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env",
    );
  }

  return { url, anonKey };
}

/** True when auth is configured (used to fail closed in the proxy). */
export function isSupabaseAuthConfigured(): boolean {
  try {
    getSupabaseAuthEnv();
    return true;
  } catch {
    return false;
  }
}
