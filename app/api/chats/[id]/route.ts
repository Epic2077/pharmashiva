import type { NextRequest } from "next/server";

import { generateChatTitle } from "@/lib/ai/chat-title";
import type { ChatModel, ChatStatus } from "@/lib/chat/types";
import { deleteChat, getChat, updateChat } from "@/lib/chats/db";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;

const STATUSES: readonly ChatStatus[] = ["open", "in_progress", "closed"];

type RouteContext = { params: Promise<{ id: string }> };

/** Load a chat with its full message history. */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const chat = await getChat(user.id, id);
    if (!chat) return jsonError("Chat not found", 404);
    return Response.json({ chat });
  } catch (error) {
    console.error("[chats] read failed:", error);
    return jsonError("Could not load the chat", 500);
  }
}

/**
 * Update a chat. Used for:
 *  - refining the title (`{ message }` → model-generated title),
 *  - explicit title/icon/status/model edits.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: {
    title?: string;
    icon?: string;
    status?: ChatStatus;
    model?: ChatModel;
  } = {};

  if (
    typeof body.status === "string" &&
    STATUSES.includes(body.status as ChatStatus)
  ) {
    patch.status = body.status as ChatStatus;
  }
  if (body.model === "flash" || body.model === "pro") {
    patch.model = body.model;
  }
  if (typeof body.icon === "string") {
    patch.icon = body.icon.slice(0, 40);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 60);
  }

  // Refine the title from the first message (best-effort, never blocks).
  const refineMessage =
    typeof body.message === "string"
      ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH)
      : "";
  if (refineMessage) {
    patch.title = await generateChatTitle({
      message: refineMessage,
      signal: request.signal,
    });
  }

  try {
    const chat = await updateChat(user.id, id, patch);
    if (!chat) return jsonError("Chat not found", 404);
    return Response.json({ chat });
  } catch (error) {
    console.error("[chats] update failed:", error);
    return jsonError("Could not update the chat", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const removed = await deleteChat(user.id, id);
    if (!removed) return jsonError("Chat not found", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[chats] delete failed:", error);
    return jsonError("Could not delete the chat", 500);
  }
}
