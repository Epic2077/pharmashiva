/**
 * Chat model profiles (server-only).
 *
 * The composer's "Think" toggle sends a `mode` of `flash` or `pro`; this module
 * is the single place that turns that mode into a concrete model + effort, so
 * the pipeline never hard-codes model names.
 */

import type { ChatModel } from "@/lib/chat/types";
import {
  DEEPSEEK_MODEL,
  DEEPSEEK_PRO_MODEL,
  DEEPSEEK_PRO_REASONING_EFFORT,
  DEEPSEEK_REASONING_EFFORT,
} from "./config";

export interface ChatModelProfile {
  model: string;
  reasoningEffort: string;
  maxTokens: number;
}

export const CHAT_MODEL_PROFILES: Record<ChatModel, ChatModelProfile> = {
  // Fast path: unchanged defaults.
  flash: {
    model: DEEPSEEK_MODEL,
    reasoningEffort: DEEPSEEK_REASONING_EFFORT,
    maxTokens: 1600,
  },
  // Deliberate path: the Pro model with a higher thinking budget.
  pro: {
    model: DEEPSEEK_PRO_MODEL,
    reasoningEffort: DEEPSEEK_PRO_REASONING_EFFORT,
    maxTokens: 3000,
  },
};

/** Map an untrusted mode string to a profile (anything unknown = flash). */
export function resolveChatModel(mode: string | null | undefined): ChatModelProfile {
  return mode === "pro" ? CHAT_MODEL_PROFILES.pro : CHAT_MODEL_PROFILES.flash;
}

/** Narrow an untrusted value to a valid `ChatModel`. */
export function coerceChatMode(value: unknown): ChatModel {
  return value === "pro" ? "pro" : "flash";
}
