"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  type LanguageCode,
} from "@/lib/i18n";
import type { ChatEvent, ChatStage } from "@/types/ai";
import { coerceSafetyAssessment } from "@/lib/safety/red-flags";
import type {
  Chat,
  ChatDetail,
  ChatMessageDto,
  ChatModel,
  ChatSummary,
  Message,
} from "./types";

/**
 * Client chat store.
 *
 * Chat metadata and messages live in Supabase; this module is the thin client
 * layer over `/api/chats` + the streaming `/api/chat` endpoint. It keeps the
 * same external-store shape the chat screens already consume (`useChat`), so the
 * UI did not need to change its data flow.
 */

const LANGUAGE_STORAGE_KEY = "pharmashiva-language";
const MAX_HISTORY = 8;

const STAGE_LABEL: Record<ChatStage, string> = {
  received: "Reading the case…",
  interpreting: "Understanding the request…",
  assessing: "Checking safety…",
  retrieving: "Finding products…",
  composing: "Composing the answer…",
  done: "",
};

export interface SendOptions {
  /** Deep-thinking mode: answers with the Pro model. */
  thinking?: boolean;
}

let chats: ReadonlyMap<string, Chat> = new Map();
const listeners = new Set<() => void>();
const activeStreams = new Map<string, AbortController>();
const loading = new Map<string, Promise<boolean>>();
const queuedStreams = new Map<
  string,
  { assistantId: string; prompt: string; options: SendOptions }[]
>();

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function readClientLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

function updateChat(chatId: string, update: (chat: Chat) => Chat) {
  const chat = chats.get(chatId);
  if (!chat) return;
  chats = new Map(chats).set(chatId, update(chat));
  emit();
}

function patchMessage(
  chatId: string,
  messageId: string,
  patch: Partial<Message>,
) {
  updateChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message,
    ),
  }));
}

function patchMessageFn(
  chatId: string,
  messageId: string,
  fn: (message: Message) => Partial<Message>,
) {
  updateChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((message) =>
      message.id === messageId ? { ...message, ...fn(message) } : message,
    ),
  }));
}

function toChat(
  detail: ChatSummary | ChatDetail,
  messages: Message[] = [],
): Chat {
  return {
    id: detail.id,
    title: detail.title,
    icon: detail.icon,
    status: detail.status,
    model: detail.model,
    createdAt: Date.parse(detail.createdAt),
    updatedAt: Date.parse(detail.updatedAt),
    memory: detail.memory,
    messages,
    streaming: false,
  };
}

function toMessage(dto: ChatMessageDto): Message {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content,
    thinking: dto.thinking ?? undefined,
    thinkingStreaming: false,
    status: null,
    safety: coerceSafetyAssessment(dto.safety) ?? undefined,
    products: dto.products ?? undefined,
    persisted: true,
  };
}

/* ── Persistence ─────────────────────────────────────────────── */

/** Write a message to Supabase. Fire-and-forget; reverts the flag on failure. */
async function persistMessage(
  chatId: string,
  message: Message,
  extra: { status?: string; model?: ChatModel } = {},
) {
  if (message.persisted) return;
  patchMessage(chatId, message.id, { persisted: true });
  try {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: message.role,
        content: message.content,
        thinking: message.thinking ?? null,
        safety: message.safety ?? null,
        products: message.products ?? null,
        status: extra.status,
        model: extra.model,
      }),
    });
    if (!response.ok) patchMessage(chatId, message.id, { persisted: false });
  } catch {
    patchMessage(chatId, message.id, { persisted: false });
  }
}

/** Ask the server to replace the provisional title with a model-written one. */
async function refineTitle(chatId: string, message: string) {
  try {
    const response = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) return;
    const { chat } = (await response.json()) as { chat: ChatSummary };
    updateChat(chatId, (current) => ({
      ...current,
      title: chat.title,
      icon: chat.icon,
      updatedAt: Date.parse(chat.updatedAt),
    }));
  } catch {
    // Keep the deterministic fallback title.
  }
}

/* ── Streaming ───────────────────────────────────────────────── */

/** Applies one streamed event to the assistant placeholder. */
function applyEvent(chatId: string, messageId: string, event: ChatEvent) {
  switch (event.type) {
    case "status":
      patchMessage(chatId, messageId, {
        status: STAGE_LABEL[event.stage] || null,
        stage: event.stage,
      });
      break;
    case "memory":
      updateChat(chatId, (chat) => ({
        ...chat,
        memory: event.memory,
      }));
      break;
    case "thinking":
      patchMessageFn(chatId, messageId, (message) => ({
        thinking: (message.thinking ?? "") + event.delta,
      }));
      break;
    case "safety":
      patchMessage(chatId, messageId, { safety: event.safety });
      break;
    case "products":
      patchMessage(chatId, messageId, {
        products: event.products,
        productsProvisional: event.provisional,
        productsDatabaseAvailable: event.databaseAvailable,
        productsQueries: event.queries,
        productsSuppressed: event.suppressed,
        productsGateReason: event.gateReason,
      });
      break;
    case "text":
      patchMessageFn(chatId, messageId, (message) => ({
        content: message.content + event.delta,
      }));
      break;
    case "error":
      patchMessage(chatId, messageId, { error: event.message });
      break;
    case "done":
      patchMessage(chatId, messageId, {
        thinkingStreaming: false,
        status: null,
        stage: null,
      });
      break;
  }
}

/** Parse an NDJSON response body into events, tolerating partial chunks. */
async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ChatEvent);
    } catch {
      // Ignore a malformed line rather than corrupting the turn.
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        flushLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    }
    flushLine(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}

/** Finish a turn: drop an empty placeholder, clear flags, persist the reply. */
function finalizeTurn(chatId: string, assistantId: string) {
  const chat = chats.get(chatId);
  const assistant = chat?.messages.find(
    (message) => message.id === assistantId,
  );

  updateChat(chatId, (current) => ({
    ...current,
    messages: current.messages
      .filter((message) => {
        if (message.id !== assistantId) return true;
        const hasContent =
          message.content.length > 0 ||
          Boolean(message.error) ||
          Boolean(message.safety) ||
          (message.products?.length ?? 0) > 0;
        return hasContent;
      })
      .map((message) =>
        message.id === assistantId
          ? { ...message, thinkingStreaming: false, status: null, stage: null }
          : message,
      ),
    streaming: false,
  }));

  if (assistant) {
    const hasContent =
      assistant.content.length > 0 ||
      Boolean(assistant.error) ||
      Boolean(assistant.safety) ||
      (assistant.products?.length ?? 0) > 0;
    if (hasContent) {
      void persistMessage(
        chatId,
        { ...assistant, thinkingStreaming: false, status: null },
        { status: "in_progress", model: chat?.model },
      );
    }
  }
}

function pushTurn(chatId: string, prompt: string): string {
  const userMessage: Message = { id: newId(), role: "user", content: prompt };
  const assistantMessage: Message = {
    id: newId(),
    role: "assistant",
    content: "",
  };

  updateChat(chatId, (chat) => ({
    ...chat,
    messages: [...chat.messages, userMessage, assistantMessage],
    streaming: true,
  }));

  void persistMessage(chatId, userMessage);

  return assistantMessage.id;
}

async function startStream(
  chatId: string,
  assistantId: string,
  prompt: string,
  options: SendOptions,
) {
  const controller = new AbortController();
  activeStreams.set(chatId, controller);

  patchMessage(chatId, assistantId, {
    thinking: "",
    thinkingStreaming: true,
    status: STAGE_LABEL.received,
  });

  const chat = chats.get(chatId);
  const history = (chat?.messages ?? [])
    .filter(
      (message) =>
        message.id !== assistantId && message.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((message) => ({ role: message.role, content: message.content }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        history,
        language: readClientLanguage(),
        mode: options.thinking ? "pro" : "flash",
        chatId,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Request failed (${response.status})`);
    }

    await readNdjson(response.body, (event) =>
      applyEvent(chatId, assistantId, event),
    );
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error("Chat stream failed:", error);
      patchMessage(chatId, assistantId, {
        error:
          "Could not reach Shiva. Please check your connection and try again.",
      });
    }
  } finally {
    activeStreams.delete(chatId);
    finalizeTurn(chatId, assistantId);

    const queued = queuedStreams.get(chatId)?.shift();
    if (queued && !controller.signal.aborted) {
      void startStream(
        chatId,
        queued.assistantId,
        queued.prompt,
        queued.options,
      );
    }
  }
}

/* ── Public API ──────────────────────────────────────────────── */

export function getChat(chatId: string) {
  return chats.get(chatId);
}

export function useChat(chatId: string | null): Chat | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (chatId ? chats.get(chatId) : undefined),
    // Chats are browser-only, so the server render always sees an empty store.
    () => undefined,
  );
}

/** Load a chat (and its messages) from the server if it is not in memory. */
export function ensureChatLoaded(chatId: string): Promise<boolean> {
  if (chats.has(chatId)) return Promise.resolve(true);

  const pending = loading.get(chatId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return false;
      const { chat } = (await response.json()) as { chat: ChatDetail };
      // A stream may have started while we were loading; never clobber it.
      if (!chats.has(chatId)) {
        const seeded = toChat(chat, chat.messages.map(toMessage));
        chats = new Map(chats).set(chatId, seeded);
        emit();
      }
      return true;
    } catch {
      return false;
    } finally {
      loading.delete(chatId);
    }
  })();

  loading.set(chatId, request);
  return request;
}

/** Create a chat from the first message, then stream its first answer. */
export async function createChat(
  prompt: string,
  options: SendOptions = {},
): Promise<string> {
  const response = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: prompt,
      thinking: options.thinking === true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not start a chat (${response.status})`);
  }

  const { chat } = (await response.json()) as { chat: ChatSummary };
  const seeded = toChat(chat);
  seeded.streaming = true;
  chats = new Map(chats).set(seeded.id, seeded);

  const assistantId = pushTurn(seeded.id, prompt);
  // Upgrade the provisional title from the model while the answer streams.
  void refineTitle(seeded.id, prompt);
  void startStream(seeded.id, assistantId, prompt, options);

  return seeded.id;
}

export function sendMessage(
  chatId: string,
  prompt: string,
  options: SendOptions = {},
) {
  const chat = chats.get(chatId);
  if (!chat) return;

  if (options.thinking !== undefined) {
    const model: ChatModel = options.thinking ? "pro" : "flash";
    if (model !== chat.model) {
      updateChat(chatId, (current) => ({ ...current, model }));
    }
  }

  const assistantId = pushTurn(chatId, prompt);

  // A reply is already streaming for this chat, so queue behind it. This also
  // prevents duplicate concurrent submissions.
  if (activeStreams.has(chatId)) {
    const queue = queuedStreams.get(chatId) ?? [];
    queue.push({ assistantId, prompt, options });
    queuedStreams.set(chatId, queue);
    return;
  }

  void startStream(chatId, assistantId, prompt, options);
}

export function stopStreaming(chatId: string) {
  const controller = activeStreams.get(chatId);
  if (controller) controller.abort();
  activeStreams.delete(chatId);

  // Drop replies that were queued but never started.
  const queue = queuedStreams.get(chatId) ?? [];
  queuedStreams.delete(chatId);
  if (queue.length === 0) return;

  const dropped = new Set(queue.map((item) => item.assistantId));
  updateChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.filter((message) => !dropped.has(message.id)),
    streaming: false,
  }));
}
