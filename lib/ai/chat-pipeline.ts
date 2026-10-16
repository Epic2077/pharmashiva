/**
 * The consultation pipeline: interpret → (safety ∥ retrieval) → stream answer.
 *
 * Design goals (see the task brief):
 *  - acknowledge immediately and stream as soon as content exists,
 *  - never let one stage block another unnecessarily,
 *  - keep the deterministic safety result authoritative,
 *  - ground every product in the database.
 */

import type { LanguageCode } from "@/lib/i18n";
import { assessSafety } from "@/lib/safety/red-flags";
import type {
  ChatEvent,
  ChatStage,
  ProductRecommendation,
  SafetyAssessment,
} from "@/types/ai";
import { extractHeuristicFacts } from "./case-heuristics";
import { isDeepSeekConfigured } from "./config";
import { resolveChatModel } from "./models";
import type { ChatModel } from "@/lib/chat/types";
import {
  streamChatCompletion,
  type DeepSeekMessage,
} from "./deepseek.service";
import { AI_UNAVAILABLE_NOTE, buildFallbackResponse } from "./fallback-response";
import { interpretCase, mergeCaseFacts } from "./interpret";
import { buildResponseUserPrompt, RESPONSE_SYSTEM_PROMPT } from "./prompts";
import { buildProductQueriesForFacts, retrieveProducts } from "./product-retrieval";
import { coerceMemory, mergeMemory, memoryToFacts } from "@/lib/chat/memory";
import type { CaseFacts, CaseMemory } from "@/types/ai";

export interface ChatPipelineParams {
  message: string;
  history: DeepSeekMessage[];
  language: LanguageCode;
  signal: AbortSignal;
  send: (event: ChatEvent) => void;
  /** `flash` (fast) or `pro` (deep thinking), from the composer's Think toggle. */
  mode?: ChatModel;
  /** Optional server-side latency logger (never receives user content). */
  log?: (timings: Record<string, number>) => void;
  /** Per-chat accumulated case memory (from previous turns). */
  memory?: CaseMemory | null;
  /** Called when the case memory is updated for this turn. */
  onMemory?: (memory: CaseMemory) => void | Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

/** Merge two ranked product lists, deduping by product id. */
function mergeProducts(
  primary: ProductRecommendation[],
  secondary: ProductRecommendation[],
  limit: number,
): ProductRecommendation[] {
  const seen = new Set<string>();
  const out: ProductRecommendation[] = [];
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.product.id)) continue;
    seen.add(item.product.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Emit a block of text as small streamed chunks (used for fallbacks only). */
async function streamText(text: string, send: (event: ChatEvent) => void) {
  const words = text.split(/(\s+)/);
  let buffer = "";
  for (let index = 0; index < words.length; index += 1) {
    buffer += words[index];
    if (buffer.length >= 12 || index === words.length - 1) {
      send({ type: "text", delta: buffer });
      buffer = "";
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }
}

function safetyEquals(a: SafetyAssessment, b: SafetyAssessment): boolean {
  return (
    a.status === b.status &&
    a.explanation === b.explanation &&
    a.nextSteps.join("|") === b.nextSteps.join("|")
  );
}

export async function runChatPipeline({
  message,
  history,
  language,
  signal,
  send,
  mode,
  log,
  memory,
  onMemory,
}: ChatPipelineParams): Promise<void> {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  const mark = (key: string) => {
    timings[key] = Date.now() - startedAt;
  };

  const stage = (value: ChatStage) => send({ type: "status", stage: value });

  stage("received");
  mark("received");

  const memoryState = coerceMemory(memory ?? null);

  // ── Step 1: instant deterministic facts + safety ──────────────
  const heuristic = extractHeuristicFacts(message);
  const instantMemory = mergeMemory(memoryState, heuristic, message);
  const instantFacts = memoryToFacts(instantMemory);
  const instantSafety = assessSafety(instantFacts, message);

  // If it already looks urgent, surface the red flag immediately.
  if (instantSafety.status === "HIGH_RISK") {
    send({
      type: "safety",
      safety: {
        ...instantSafety,
        deterministicOnly: !isDeepSeekConfigured(),
      },
    });
  }
  mark("safetyInstant");

  // ── Step 2: interpretation and provisional retrieval in parallel ──
  stage("interpreting");
  const [interpretation, earlyRetrieval] = await Promise.all([
    interpretCase({ message, history, signal, memory: memoryState }),
    retrieveProducts({
      facts: instantFacts,
      message,
      language,
      provisional: true,
      signal,
    }),
  ]);
  mark("interpreted");

  const facts = mergeCaseFacts(heuristic, interpretation.facts);

  // ── Step 3: authoritative safety assessment ───────────────────
  stage("assessing");
  const updatedMemory = mergeMemory(memoryState, facts, message);
  const caseFacts: CaseFacts = {
    ...memoryToFacts(updatedMemory),
    summary: facts.summary,
    category: facts.category,
    missingInformation: facts.missingInformation,
    inferredFacts: facts.inferredFacts,
  };

  send({ type: "memory", memory: updatedMemory });
  await onMemory?.(updatedMemory);
  mark("memory");

  const safety: SafetyAssessment = {
    ...assessSafety(caseFacts, message),
    deterministicOnly: interpretation.fallback,
  };

  const shouldShowSafety =
    safety.status !== "LOWER_RISK" || caseFacts.symptoms.length > 0;
  if (shouldShowSafety && !safetyEquals(instantSafety, safety)) {
    send({ type: "safety", safety });
  }
  mark("safety");

  // ── Step 4: retrieval (refine if the interpretation adds value) ──
  stage("retrieving");
  const provisional = safety.status !== "LOWER_RISK";
  let products = earlyRetrieval.products;
  let databaseAvailable = earlyRetrieval.databaseAvailable;

  // The model's product queries drive a refined AI search. Without them we fall
  // back to the catalog's own (sentence-capable) search, and only spend a second
  // query when the first pass found little.
  const hasAiQueries = caseFacts.productQueries.length > 0;

  if (hasAiQueries) {
    const refined = await retrieveProducts({
      facts: caseFacts,
      message,
      language,
      provisional,
      signal,
    });
    // If AI suggestions found products, use them as the primary result.
    if (refined.products.length > 0) {
      products = refined.products;
      databaseAvailable = refined.databaseAvailable;
    } else {
      products = mergeProducts(refined.products, products, 6);
      databaseAvailable = databaseAvailable || refined.databaseAvailable;
    }
  } else if (products.length < 3) {
    const refined = await retrieveProducts({
      facts: caseFacts,
      message,
      language,
      provisional,
      signal,
    });
    products = mergeProducts(refined.products, products, 6);
    databaseAvailable = databaseAvailable || refined.databaseAvailable;
  }

  products = products.map((item) => ({ ...item, provisional }));

  const productQueriesUsed =
    caseFacts.productQueries.length > 0
      ? caseFacts.productQueries.slice(0, 3)
      : buildProductQueriesForFacts(caseFacts);

  send({
    type: "products",
    products: databaseAvailable ? products : [],
    provisional,
    databaseAvailable,
    queries: productQueriesUsed,
  });
  mark("database");

  // ── Step 5: stream the explanation ────────────────────────────
  stage("composing");

  const runFallback = async (extraNote?: string) => {
    let text = buildFallbackResponse({ facts: caseFacts, safety, products });
    if (extraNote) text += `\n\n${extraNote}`;
    await streamText(text, send);
  };

  if (!isDeepSeekConfigured()) {
    await runFallback(AI_UNAVAILABLE_NOTE);
  } else {
    const streamMessages: DeepSeekMessage[] = [
      { role: "system", content: RESPONSE_SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: buildResponseUserPrompt({ message, facts: caseFacts, safety, products }),
      },
    ];

    let firstToken = false;
    const profile = resolveChatModel(mode);
    try {
      for await (const delta of streamChatCompletion({
        messages: streamMessages,
        model: profile.model,
        reasoningEffort: profile.reasoningEffort,
        signal,
        maxTokens: profile.maxTokens,
      })) {
        if (signal.aborted) return;
        if (delta.reasoning) send({ type: "thinking", delta: delta.reasoning });
        if (delta.content) {
          if (!firstToken) {
            firstToken = true;
            mark("firstToken");
          }
          send({ type: "text", delta: delta.content });
        }
      }

      if (!firstToken) {
        await runFallback(AI_UNAVAILABLE_NOTE);
      }
    } catch (error) {
      if (isAbortError(error) || signal.aborted) throw error;
      await runFallback(AI_UNAVAILABLE_NOTE);
    }
  }

  mark("done");
  send({ type: "done", timings });
  log?.(timings);
}
