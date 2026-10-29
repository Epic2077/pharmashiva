/**
 * DeepSeek chat-completion client (server-only).
 *
 * The API is OpenAI-compatible:
 *   POST {DEEPSEEK_BASE_URL}/chat/completions
 *
 * We talk to it with native `fetch` so we don't introduce an SDK dependency.
 * `streamChatCompletion` parses the SSE stream (including partial chunks and
 * the terminating `data: [DONE]`), while `jsonChatCompletion` asks for a single
 * validated JSON object (used for case interpretation).
 *
 * Key/secret handling: the API key is only ever read here, on the server.
 */

import {
  AI_TIMEOUTS,
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_INTERPRET_MODEL,
  DEEPSEEK_MODEL,
  DEEPSEEK_REASONING_EFFORT,
} from "./config";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekDelta {
  content: string;
  reasoning: string;
}

export class DeepSeekError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DeepSeekError";
    this.status = status;
  }
}

/** Combine a caller signal with a hard timeout so requests can never hang. */
function requestSignal(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;

  const withAny = AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof withAny.any === "function") {
    return withAny.any([signal, timeout]);
  }

  // Fallback for runtimes without AbortSignal.any.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const trimmed = text.trim().slice(0, 300);
    return trimmed ? `: ${trimmed}` : "";
  } catch {
    return "";
  }
}

function parseSseLine(line: string): DeepSeekDelta | "done" | null {
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trim();
  if (!data) return null;
  if (data === "[DONE]") return "done";

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
        };
      }>;
    };
    const delta = parsed.choices?.[0]?.delta;
    const content = typeof delta?.content === "string" ? delta.content : "";
    const reasoning =
      typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "";
    if (!content && !reasoning) return null;
    return { content, reasoning };
  } catch {
    // A malformed/partial line — skip it rather than corrupt the stream.
    return null;
  }
}

export interface StreamChatOptions {
  messages: DeepSeekMessage[];
  signal?: AbortSignal;
  model?: string;
  reasoningEffort?: string;
  maxTokens?: number;
}

/**
 * Stream a chat completion. Yields text and reasoning deltas as they arrive.
 * Throws `DeepSeekError` on a non-2xx response; a caller cancellation surfaces
 * as the usual `AbortError`.
 */
export async function* streamChatCompletion({
  messages,
  signal,
  model = DEEPSEEK_MODEL,
  reasoningEffort = DEEPSEEK_REASONING_EFFORT,
  maxTokens = 900,
}: StreamChatOptions): AsyncGenerator<DeepSeekDelta> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      thinking: { type: reasoningEffort === "none" ? "disabled" : "enabled" },
      reasoning_effort: reasoningEffort,
    }),
    signal: requestSignal(signal, AI_TIMEOUTS.respondMs),
  });

  if (!response.ok || !response.body) {
    throw new DeepSeekError(
      `DeepSeek request failed (${response.status})${await readErrorDetail(response)}`,
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "").trim();
        buffer = buffer.slice(newlineIndex + 1);
        const parsed = parseSseLine(line);
        if (parsed === "done") return;
        if (parsed) yield parsed;
      }
    }

    // Flush a trailing line that arrived without a newline.
    const tail = buffer.replace(/\r$/, "").trim();
    if (tail) {
      const parsed = parseSseLine(tail);
      if (parsed && parsed !== "done") yield parsed;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader already released/closed.
    }
  }
}

export interface JsonChatOptions {
  messages: DeepSeekMessage[];
  signal?: AbortSignal;
  model?: string;
  maxTokens?: number;
}

/**
 * Single non-streaming JSON completion. Thinking is disabled to keep this call
 * fast; the response is a parsed-but-untrusted `unknown` that the caller must
 * validate before use.
 */
export async function jsonChatCompletion({
  messages,
  signal,
  model = DEEPSEEK_INTERPRET_MODEL,
  maxTokens = 700,
}: JsonChatOptions): Promise<unknown> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      reasoning_effort: "none",
      // Case interpretation is an extraction task, not creative writing. A
      // deterministic temperature keeps the model's `productQueries` stable
      // across turns, so "red eye" reliably maps to eye drops instead of
      // flipping between queries between requests.
      temperature: 0,
    }),
    signal: requestSignal(signal, AI_TIMEOUTS.interpretMs),
  });

  if (!response.ok) {
    throw new DeepSeekError(
      `DeepSeek request failed (${response.status})${await readErrorDetail(response)}`,
      response.status,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new DeepSeekError("DeepSeek returned an empty response");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new DeepSeekError("DeepSeek returned invalid JSON");
  }
}
