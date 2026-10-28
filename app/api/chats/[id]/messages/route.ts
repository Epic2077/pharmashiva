import type { NextRequest } from "next/server";

import type { ChatModel, ChatStatus } from "@/lib/chat/types";
import { appendChatMessage } from "@/lib/chats/db";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api/guard";
import type { ProductRecommendation, SafetyAssessment } from "@/types/ai";
import type { MedicalReference } from "@/lib/medical-reference/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 20_000;
const MAX_PRODUCTS = 12;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Append a message to a chat. Called by the client after a user turn is sent
 * and after an assistant turn finishes streaming.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body", 400);

  const role = body.role === "assistant" ? "assistant" : "user";
  const content =
    typeof body.content === "string"
      ? body.content.slice(0, MAX_CONTENT_LENGTH)
      : "";
  const thinking =
    typeof body.thinking === "string"
      ? body.thinking.slice(0, MAX_CONTENT_LENGTH)
      : null;
  const safety =
    body.safety && typeof body.safety === "object"
      ? (body.safety as SafetyAssessment)
      : null;
  const products = Array.isArray(body.products)
    ? (body.products.slice(0, MAX_PRODUCTS) as ProductRecommendation[])
    : null;
  const references = Array.isArray(body.references)
    ? (body.references.slice(0, 12) as MedicalReference[])
    : null;

  const status: ChatStatus | null =
    role === "assistant"
      ? "in_progress"
      : typeof body.status === "string"
        ? (body.status as ChatStatus)
        : null;
  const model: ChatModel | null =
    body.model === "pro" ? "pro" : body.model === "flash" ? "flash" : null;

  // A message must actually carry something to be worth storing.
  if (!content.trim() && !safety && !products?.length && !references?.length) {
    return jsonError("Nothing to save", 400);
  }

  try {
    const message = await appendChatMessage(user.id, id, {
      role,
      content,
      thinking,
      status,
      model,
      safety,
      products,
      references,
    });
    if (!message) return jsonError("Chat not found", 404);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error("[chats] append failed:", error);
    return jsonError("Could not save the message", 500);
  }
}
