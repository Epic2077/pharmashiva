import type { NextRequest } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/** Small helpers shared by the API route handlers. */

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Reject cross-origin browser requests when an Origin header is present. */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(
  request: NextRequest,
  maxBytes = 256 * 1024,
): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return null;
  try {
    const body = await request.json();
    return (body ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the signed-in user, or `null`. Route handlers cannot rely on the
 * proxy matcher (the API is excluded from it), so each one calls this.
 */
export async function requireUser(): Promise<SessionUser | null> {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
}
