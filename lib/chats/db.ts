import { coerceChatIcon } from "@/lib/chat/icons";
import type {
  ChatDetail,
  ChatMessageDto,
  ChatModel,
  ChatStatus,
  ChatSummary,
} from "@/lib/chat/types";
import type {
  CaseMemory,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";
import type { MedicalReference } from "@/lib/medical-reference/types";
import { getSupabaseClient } from "@/lib/supabase/server";
import { coerceMemory } from "@/lib/chat/memory";
import { coerceSafetyAssessment } from "@/lib/safety/red-flags";

/**
 * Server-only data access for chats and messages.
 *
 * Uses the service-role client (the catalog tables are not exposed to the Data
 * API) and therefore scopes **every** query by `user_id` itself. RLS policies on
 * both tables are still enabled as defence-in-depth.
 *
 * Rows are coerced before leaving this module: stored strings are narrowed back
 * to the app's union types, so a bad row can never widen a type upstream.
 */

interface ChatRow {
  id: string;
  title: string | null;
  icon: string | null;
  status: string | null;
  model: string | null;
  memory: unknown;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  role: string;
  content: string | null;
  thinking: string | null;
  safety: unknown;
  products: unknown;
  references: unknown;
  created_at: string;
}

const CHAT_COLUMNS =
  "id, title, icon, status, model, memory, created_at, updated_at";
const MESSAGE_COLUMNS =
  "id, role, content, thinking, safety, products, references, created_at";

function coerceStatus(value: string | null): ChatStatus {
  return value === "in_progress" || value === "closed" ? value : "open";
}

function coerceModel(value: string | null): ChatModel {
  return value === "pro" ? "pro" : "flash";
}

function mapChat(row: ChatRow): ChatSummary {
  return {
    id: row.id,
    title: row.title?.trim() || "New consultation",
    icon: coerceChatIcon(row.icon),
    status: coerceStatus(row.status),
    model: coerceModel(row.model),
    memory: coerceMemory(row.memory),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ChatMessageDto {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content ?? "",
    thinking: row.thinking ?? null,
    safety: coerceSafetyAssessment(row.safety),
    products: (row.products ?? null) as ProductRecommendation[] | null,
    references: (row.references ?? null) as MedicalReference[] | null,
    createdAt: row.created_at,
  };
}

/** True when `chatId` exists and belongs to `userId`. */
export async function chatBelongsToUser(
  userId: string,
  chatId: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function createChat(input: {
  userId: string;
  title: string;
  icon: string;
  model: ChatModel;
}): Promise<ChatSummary> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chats")
    .insert({
      user_id: input.userId,
      title: input.title,
      icon: input.icon,
      model: input.model,
    })
    .select(CHAT_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create chat");
  }
  return mapChat(data as unknown as ChatRow);
}

export async function listChats(
  userId: string,
  limit = 50,
): Promise<ChatSummary[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chats")
    .select(CHAT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ChatRow[]).map(mapChat);
}

export async function getChat(
  userId: string,
  chatId: string,
): Promise<ChatDetail | null> {
  const sb = getSupabaseClient();
  const { data: chat, error } = await sb
    .from("chats")
    .select(CHAT_COLUMNS)
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!chat) return null;

  const { data: messages, error: messagesError } = await sb
    .from("chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(messagesError.message);

  return {
    ...mapChat(chat as unknown as ChatRow),
    messages: ((messages ?? []) as unknown as MessageRow[]).map(mapMessage),
  };
}

export interface AppendMessageInput {
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  status?: ChatStatus | null;
  model?: ChatModel | null;
  safety?: SafetyAssessment | null;
  products?: ProductRecommendation[] | null;
  references?: MedicalReference[] | null;
}

/**
 * Append a message to a chat the user owns.
 * Returns `null` when the chat does not exist or is not theirs.
 */
export async function appendChatMessage(
  userId: string,
  chatId: string,
  message: AppendMessageInput,
): Promise<ChatMessageDto | null> {
  if (!(await chatBelongsToUser(userId, chatId))) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      role: message.role,
      content: message.content ?? "",
      thinking: message.thinking ?? null,
      safety: message.safety ?? null,
      products: message.products ?? null,
      references: message.references ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save message");
  }

  // Bump recency (and keep the chat's model/status in step with the turn).
  const patch: Record<string, unknown> = {};
  if (message.status) patch.status = message.status;
  if (message.model) patch.model = message.model;
  await sb.from("chats").update(patch).eq("id", chatId).eq("user_id", userId);

  return mapMessage(data as unknown as MessageRow);
}

export async function updateChat(
  userId: string,
  chatId: string,
  patch: {
    title?: string;
    icon?: string;
    status?: ChatStatus;
    model?: ChatModel;
    memory?: CaseMemory;
  },
): Promise<ChatSummary | null> {
  const update: Record<string, unknown> = {};
  if (typeof patch.title === "string") update.title = patch.title;
  if (typeof patch.icon === "string") update.icon = patch.icon;
  if (patch.status) update.status = patch.status;
  if (patch.model) update.model = patch.model;
  if (patch.memory) update.memory = patch.memory;
  if (Object.keys(update).length === 0) {
    const current = await getChat(userId, chatId);
    if (!current) return null;
    return {
      id: current.id,
      title: current.title,
      icon: current.icon,
      status: current.status,
      model: current.model,
      memory: current.memory,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    };
  }

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chats")
    .update(update)
    .eq("id", chatId)
    .eq("user_id", userId)
    .select(CHAT_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapChat(data as unknown as ChatRow) : null;
}

export async function getChatMemory(
  userId: string,
  chatId: string,
): Promise<CaseMemory | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("chats")
    .select("memory")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { memory?: unknown };
  return coerceMemory(row.memory);
}

export async function saveChatMemory(
  userId: string,
  chatId: string,
  memory: CaseMemory,
): Promise<boolean> {
  const sb = getSupabaseClient();
  const { error, count } = await sb
    .from("chats")
    .update({ memory }, { count: "exact" })
    .eq("id", chatId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function deleteChat(
  userId: string,
  chatId: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  const { error, count } = await sb
    .from("chats")
    .delete({ count: "exact" })
    .eq("id", chatId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
