import type { NextRequest } from "next/server";

import { chatIconFor, fallbackChatTitle } from "@/lib/ai/chat-title";
import type { ChatModel } from "@/lib/chat/types";
import { createChat, listChats } from "@/lib/chats/db";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;

/** List the signed-in user's chats, newest first. */
export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  try {
    const chats = await listChats(user.id);
    return Response.json({ chats });
  } catch (error) {
    console.error("[chats] list failed:", error);
    return jsonError("Could not load chats", 500);
  }
}

/**
 * Create a chat from the first message.
 *
 * The row is inserted immediately with a deterministic title + icon so the
 * first reply is never delayed by the title model; the client then asks the
 * PATCH endpoint to refine the title while the answer streams.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body", 400);

  const message =
    typeof body.message === "string"
      ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH)
      : "";
  if (!message) return jsonError("A non-empty message is required", 400);

  const model: ChatModel = body.thinking === true ? "pro" : "flash";

  try {
    const chat = await createChat({
      userId: user.id,
      title: fallbackChatTitle(message),
      icon: chatIconFor(message),
      model,
    });
    return Response.json({ chat }, { status: 201 });
  } catch (error) {
    console.error("[chats] create failed:", error);
    return jsonError("Could not create the chat", 500);
  }
}
