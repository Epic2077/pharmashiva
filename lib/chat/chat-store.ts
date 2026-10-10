import { useSyncExternalStore } from "react";
import { mockReply } from "./mock-responses";
import type { Chat, Message } from "./types";

/** Delay before the first token lands, so the typing indicator is visible. */
const THINKING_DELAY = 420;
/** Delay between streamed tokens. */
const TOKEN_DELAY = 26;

let chats: ReadonlyMap<string, Chat> = new Map();
const listeners = new Set<() => void>();
const activeStreams = new Map<string, { aborted: boolean }>();
const queuedStreams = new Map<string, { assistantId: string; prompt: string }[]>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function titleFrom(prompt: string) {
  const title = prompt.trim().replace(/\s+/g, " ");
  return title.length > 36 ? `${title.slice(0, 36)}…` : title;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateChat(chatId: string, update: (chat: Chat) => Chat) {
  const chat = chats.get(chatId);
  if (!chat) return;

  chats = new Map(chats).set(chatId, update(chat));
  listeners.forEach((listener) => listener());
}

function appendChunk(chatId: string, messageId: string, chunk: string) {
  updateChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((message) =>
      message.id === messageId
        ? { ...message, content: message.content + chunk }
        : message
    ),
  }));
}

/**
 * Appends a user message plus an empty assistant placeholder the stream fills in.
 * Returns the placeholder id so the caller can stream into it.
 */
function pushTurn(chatId: string, prompt: string) {
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

  return assistantMessage.id;
}

async function startStream(chatId: string, assistantId: string, prompt: string) {
  const stream = { aborted: false };
  activeStreams.set(chatId, stream);

  await delay(THINKING_DELAY);

  const tokens = mockReply(prompt).split(" ");
  for (let index = 0; index < tokens.length; index += 1) {
    if (stream.aborted) break;
    await delay(TOKEN_DELAY + Math.random() * 40);
    appendChunk(chatId, assistantId, index === 0 ? tokens[index] : ` ${tokens[index]}`);
  }

  activeStreams.delete(chatId);
  updateChat(chatId, (chat) => ({
    ...chat,
    // Drop the placeholder if the reply was stopped before the first token.
    messages: chat.messages.filter(
      (message) => !(message.id === assistantId && message.content.length === 0)
    ),
    streaming: false,
  }));

  const queued = queuedStreams.get(chatId)?.shift();
  if (queued && !stream.aborted) {
    startStream(chatId, queued.assistantId, queued.prompt);
  }
}

export function getChat(chatId: string) {
  return chats.get(chatId);
}

export function useChat(chatId: string | null): Chat | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (chatId ? chats.get(chatId) : undefined),
    // Chats are browser-only, so the server render always sees an empty store.
    () => undefined
  );
}

/**
 * Creates a chat seeded with the first message and starts its reply.
 * Replace with a server action once the backend is wired up.
 */
export function createChat(prompt: string): string {
  const chatId = newId();
  const chat: Chat = {
    id: chatId,
    title: titleFrom(prompt),
    createdAt: Date.now(),
    messages: [],
    streaming: true,
  };

  chats = new Map(chats).set(chatId, chat);
  const assistantId = pushTurn(chatId, prompt);
  startStream(chatId, assistantId, prompt);

  return chatId;
}

export function sendMessage(chatId: string, prompt: string) {
  if (!chats.has(chatId)) return;

  const assistantId = pushTurn(chatId, prompt);

  // A reply is already streaming for this chat, so queue this one behind it.
  if (activeStreams.has(chatId)) {
    const queue = queuedStreams.get(chatId) ?? [];
    queue.push({ assistantId, prompt });
    queuedStreams.set(chatId, queue);
    return;
  }

  startStream(chatId, assistantId, prompt);
}

export function stopStreaming(chatId: string) {
  const stream = activeStreams.get(chatId);
  if (stream) stream.aborted = true;

  // Drop replies that were queued but never started.
  const queue = queuedStreams.get(chatId) ?? [];
  queuedStreams.delete(chatId);
  if (queue.length === 0) return;

  const dropped = new Set(queue.map((item) => item.assistantId));
  updateChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.filter((message) => !dropped.has(message.id)),
  }));
}
