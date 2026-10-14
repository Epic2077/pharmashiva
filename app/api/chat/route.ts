import type { NextRequest } from "next/server";
import { runChatPipeline } from "@/lib/ai/chat-pipeline";
import { isDeepSeekConfigured } from "@/lib/ai/config";
import { coerceChatMode } from "@/lib/ai/models";
import { requireUser } from "@/lib/api/guard";
import type { DeepSeekMessage } from "@/lib/ai/deepseek.service";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import type { ChatEvent } from "@/types/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 8;
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

/* ── Best-effort rate limiting (per instance) ────────────────── */

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

/* ── Input validation ───────────────────────────────────────── */

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function readHistory(value: unknown): DeepSeekMessage[] {
  if (!Array.isArray(value)) return [];
  const items: DeepSeekMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const trimmed = content.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) continue;
    items.push({ role, content: trimmed });
  }
  return items.slice(-MAX_HISTORY);
}

function publicError(error: unknown): string {
  if (error instanceof Error && error.name === "DeepSeekError") {
    return "The AI assistant is temporarily unavailable. Showing catalog and safety results.";
  }
  return "Something went wrong while generating the response. Please try again.";
}

/* ── Handler ────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  // Light CSRF guard: reject cross-origin browser requests when an Origin is
  // present. (Non-browser clients with no Origin are allowed.)
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return jsonError("Forbidden", 403);
      }
    } catch {
      return jsonError("Forbidden", 403);
    }
  }

  // Only signed-in users may spend the model budget.
  if (!(await requireUser())) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowRequest(clientIp(request))) {
    return jsonError("Too many requests. Please slow down.", 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError("Request too large", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message.trim().slice(0, MAX_MESSAGE_LENGTH)
      : "";
  if (!message) {
    return jsonError("A non-empty message is required", 400);
  }

  const history = readHistory(record.history);
  const requestedLanguage = record.language;
  const language: LanguageCode =
    typeof requestedLanguage === "string" && isLanguageCode(requestedLanguage)
      ? requestedLanguage
      : await getServerLanguage();

  // "Think" toggle: only the two known modes are honoured.
  const mode = coerceChatMode(record.mode);

  // Abort the upstream work when the client disconnects.
  const signal = request.signal;
  const encoder = new TextEncoder();
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        if (finished) return;
        if (event.type === "done") finished = true;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          finished = true;
        }
      };

      try {
        await runChatPipeline({
          message,
          history,
          language,
          signal,
          send,
          mode,
          log: (timings) => {
            // Latency only — never logs conversation content.
            console.info(
              "[chat] timings(ms)",
              JSON.stringify(timings),
              isDeepSeekConfigured() ? "deepseek" : "deterministic-only",
            );
          },
        });
      } catch (error) {
        if (!signal.aborted) {
          console.error("[chat] pipeline failed:", error);
          send({ type: "error", message: publicError(error) });
        }
      } finally {
        if (!signal.aborted && !finished) send({ type: "done" });
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      finished = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
