"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import type { AuthActionState } from "./types";

/**
 * Server actions for authentication.
 *
 * Everything happens on the server so the anon key and session cookies never
 * touch client JS. Per the Next 16 docs, server functions verify the caller
 * themselves rather than relying on the proxy matcher.
 */

const MIN_PASSWORD_LENGTH = 8;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Only allow same-site, path-relative redirect targets. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

function notConfigured(): AuthActionState {
  return {
    error:
      "Authentication is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
  };
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseAuthConfigured()) return notConfigured();

  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const next = safeNext(str(formData, "next"));

  if (!email || !password) {
    return { error: "Enter your email and password to continue." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Those credentials don't match an account." };
  }

  redirect(next);
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseAuthConfigured()) return notConfigured();

  const fullName = str(formData, "fullName");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const confirmPassword = str(formData, "confirmPassword");

  if (!fullName) return { error: "Please tell us your name." };
  if (!email) return { error: "Please enter your email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirmPassword) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation off we already have a session; otherwise the user
  // must click the link we just sent.
  if (data.session) redirect("/home");
  return {
    notice: "Check your inbox — we sent a link to confirm your email address.",
  };
}

/**
 * Google sign-in. Used via `<button formAction={googleAction}>`, so it takes the
 * form data directly and always redirects (to Google, or back with an error).
 */
export async function googleAction(formData: FormData): Promise<void> {
  const next = safeNext(str(formData, "next"));

  if (!isSupabaseAuthConfigured()) {
    redirect("/auth/login?error=config");
  }
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    (() => {
      const host =
        headerStore.get("x-forwarded-host") ?? headerStore.get("host");
      const proto = headerStore.get("x-forwarded-proto") ?? "http";
      return host ? `${proto}://${host}` : "";
    })();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) redirect("/auth/login?error=google");
  if (data.url) redirect(data.url);

  redirect("/auth/login?error=google");
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/auth/login");
}
