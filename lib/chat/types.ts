import type {
  CaseMemory,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";

export type MessageRole = "user" | "assistant";

/** Lifecycle of a consultation, mirrored in the `chats.status` column. */
export type ChatStatus = "open" | "in_progress" | "closed";

/** Which DeepSeek model answers the turn. `pro` = deeper "thinking" mode. */
export type ChatModel = "flash" | "pro";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  /** Streamed reasoning shown in the Thinking tab. */
  thinking?: string;
  /** True while reasoning is still arriving. */
  thinkingStreaming?: boolean;
  /** Short label for the current pipeline stage, cleared when done. */
  status?: string | null;
  /** Authoritative safety result for this turn. */
  safety?: SafetyAssessment;
  /** Database-backed product cards. */
  products?: ProductRecommendation[];
  /** True while the safety assessment is not LOWER_RISK. */
  productsProvisional?: boolean;
  /** False when the catalog could not be reached. */
  productsDatabaseAvailable?: boolean;
  /** Queries that were executed against the database. */
  productsQueries?: string[];
  /** Fatal error for this turn. */
  error?: string | null;
  /** Set once the message has been written to Supabase. */
  persisted?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  /** Lucide icon slug chosen for the chat (see `lib/chat/icons.ts`). */
  icon: string;
  status: ChatStatus;
  model: ChatModel;
  /** Accumulated case memory for this chat (see `lib/chat/memory.ts`). */
  memory: CaseMemory;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  streaming: boolean;
}

/* ── Wire shapes (server ↔ client over /api/chats) ───────────── */

export interface ChatSummary {
  id: string;
  title: string;
  icon: string;
  status: ChatStatus;
  model: ChatModel;
  /** Accumulated case memory; `{}`-shaped when the chat is brand new. */
  memory: CaseMemory;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDto {
  id: string;
  role: MessageRole;
  content: string;
  thinking: string | null;
  safety: SafetyAssessment | null;
  products: ProductRecommendation[] | null;
  createdAt: string;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessageDto[];
}
