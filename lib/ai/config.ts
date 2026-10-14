/**
 * Server-only DeepSeek configuration.
 *
 * Keep every model name and endpoint here so it is configurable in one place
 * instead of being scattered through the pipeline. Never import this from a
 * client component — it reads the server environment.
 *
 * Environment:
 *   DEEPSEEK_API_KEY            (required for AI features)
 *   DEEPSEEK_BASE_URL           (optional, default https://api.deepseek.com)
 *   DEEPSEEK_MODEL              (optional, default deepseek-flash)
 *   DEEPSEEK_INTERPRET_MODEL    (optional, defaults to DEEPSEEK_MODEL)
 *   DEEPSEEK_PRO_MODEL          (optional, default deepseek-v4-pro)
 *   DEEPSEEK_REASONING_EFFORT   (optional, low|high|max, default low)
 *   DEEPSEEK_PRO_REASONING_EFFORT (optional, defaults to DEEPSEEK_REASONING_EFFORT)
 *   DEEPSEEK_INTERPRET_TIMEOUT_MS
 *   DEEPSEEK_RESPONSE_TIMEOUT_MS
 */

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const DEEPSEEK_BASE_URL = (
  env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com"
).replace(/\/+$/, "");

/** Fast chat model used for both interpretation and the final answer. */
export const DEEPSEEK_MODEL = env("DEEPSEEK_MODEL") || "deepseek-flash";

export const DEEPSEEK_INTERPRET_MODEL =
  env("DEEPSEEK_INTERPRET_MODEL") || DEEPSEEK_MODEL;

/**
 * Deeper model used when the composer's "Think" toggle is on. Kept separate from
 * `DEEPSEEK_MODEL` so the fast path and the deliberate path can be tuned (or
 * pointed at different providers) independently.
 */
export const DEEPSEEK_PRO_MODEL = env("DEEPSEEK_PRO_MODEL") || "deepseek-v4-pro";

/**
 * Thinking effort for the final answer. `low` keeps latency down while still
 * producing a `reasoning_content` trace for the Thinking tab.
 */
export const DEEPSEEK_REASONING_EFFORT =
  env("DEEPSEEK_REASONING_EFFORT") || "low";

/** Deeper thinking effort used with `DEEPSEEK_PRO_MODEL`. */
export const DEEPSEEK_PRO_REASONING_EFFORT =
  env("DEEPSEEK_PRO_REASONING_EFFORT") || "high";

export const DEEPSEEK_API_KEY = env("DEEPSEEK_API_KEY");

/** Request timeouts (ms) so a slow provider can never hang the stream. */
export const AI_TIMEOUTS = {
  interpretMs: Number(env("DEEPSEEK_INTERPRET_TIMEOUT_MS")) || 7000,
  respondMs: Number(env("DEEPSEEK_RESPONSE_TIMEOUT_MS")) || 25000,
} as const;

/** True when the API key is present. When false the pipeline degrades safely. */
export function isDeepSeekConfigured(): boolean {
  return DEEPSEEK_API_KEY.length > 0;
}
