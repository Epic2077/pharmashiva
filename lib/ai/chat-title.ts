/**
 * Chat title generation (server-only).
 *
 * The first message is turned into a short, human title with a small JSON call
 * on the fast model. On any failure we fall back to a deterministic slice of the
 * message, so creating a chat never blocks on the model.
 */

import { pickChatIcon, type ChatIconSlug } from "@/lib/chat/icons";
import { DEEPSEEK_INTERPRET_MODEL, isDeepSeekConfigured } from "./config";
import { jsonChatCompletion } from "./deepseek.service";

const TITLE_SYSTEM_PROMPT = `You name pharmacy consultation threads.
Given the patient's first message, reply with ONLY a JSON object: {"title": "..."}.
Rules:
- 2 to 3 words, Title Case, no trailing punctuation and no surrounding quotes.
- If the client name appears in the message, include it. Otherwise do NOT invent or add a name.
- Focus on the main complaint/problem (e.g. "John Headache", "Tension Headache", "Child Fever").
- Always write the title in English, even when the message is not.
- Never include brands, dosages, ages, or other personal identifiers.`;

/** Deterministic fallback title derived from the raw message. */
export function fallbackChatTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ");
  if (!clean) return "New consultation";
  if (clean.length <= 48) return clean;

  const clipped = clean.slice(0, 48);
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed = lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped;
  return `${trimmed}…`;
}

/** Deterministic icon for a chat's first message. */
export function chatIconFor(message: string): ChatIconSlug {
  return pickChatIcon(message);
}

/** Ask the model for a short title; never throws. */
export async function generateChatTitle(params: {
  message: string;
  signal?: AbortSignal;
}): Promise<string> {
  const fallback = fallbackChatTitle(params.message);
  if (!isDeepSeekConfigured()) return fallback;

  try {
    const raw = await jsonChatCompletion({
      messages: [
        { role: "system", content: TITLE_SYSTEM_PROMPT },
        { role: "user", content: params.message.slice(0, 600) },
      ],
      model: DEEPSEEK_INTERPRET_MODEL,
      maxTokens: 60,
      signal: params.signal,
    });

    const title =
      raw && typeof raw === "object" && "title" in raw
        ? String((raw as { title?: unknown }).title ?? "")
        : "";

    const cleaned = title
      .trim()
      .replace(/^["'«»\s]+|["'«»\s]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 60);

    return cleaned || fallback;
  } catch {
    return fallback;
  }
}
