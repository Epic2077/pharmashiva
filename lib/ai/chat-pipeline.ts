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
import {
  localizeCategoryName,
  translateFaToEnBounded,
} from "@/lib/i18n-server";
import {
  applyModelConcerns,
  applyModelFollowUpQuestions,
  assessSafety,
  isAllergyOnlyConcern,
} from "@/lib/safety/red-flags";
import type {
  ChatEvent,
  ChatStage,
  PipelineDiagnostics,
  PipelineReport,
  PipelineTimings,
  ProductRecommendation,
  SafetyAssessment,
  ShoppingIntent,
} from "@/types/ai";
import { extractHeuristicFacts } from "./case-heuristics";
import { isDeepSeekConfigured } from "./config";
import { resolveChatModel } from "./models";
import type { ChatModel } from "@/lib/chat/types";
import { streamChatCompletion, type DeepSeekMessage } from "./deepseek.service";
import {
  AI_UNAVAILABLE_NOTE,
  buildFallbackResponse,
} from "./fallback-response";
import { interpretCase, mergeCaseFacts } from "./interpret";
import { buildResponseUserPrompt, RESPONSE_SYSTEM_PROMPT } from "./prompts";
import {
  buildProductQueriesForFacts,
  retrieveProducts,
  type ProductRetrievalResult,
} from "./product-retrieval";
import { planProductEmission } from "./product-gating";
import { poolProductRecommendations } from "./product-pool";
import { planSafetyEvent, shouldSendInstantSafety } from "./safety-events";
import { coerceMemory, mergeMemory, memoryToFacts } from "@/lib/chat/memory";
import type { CaseFacts, CaseMemory } from "@/types/ai";
import { searchMedicalReferences } from "@/lib/medical-reference";
import type { MedicalReference } from "@/lib/medical-reference/types";

export interface ChatPipelineParams {
  message: string;
  history: DeepSeekMessage[];
  language: LanguageCode;
  signal: AbortSignal;
  send: (event: ChatEvent) => void;
  /** `flash` (fast) or `pro` (deep thinking), from the composer's Think toggle. */
  mode?: ChatModel;
  /** Optional server-side diagnostics logger (never receives user content). */
  log?: (report: PipelineReport) => void;
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

/**
 * Pick a bounded query for the Medical Reference search. Symptom search terms
 * are preferred; a definition-style question uses the message itself.
 */
function buildMedicalQuery(message: string, facts: CaseFacts): string | null {
  const terms = facts.searchTerms.filter(Boolean);
  if (terms.length > 0) return terms.slice(0, 2).join(" ").slice(0, 200);
  if (/what is|what are|\bdefine\b|\bmeaning\b|چیست|یعنی|تعریف/i.test(message)) {
    return message.trim().slice(0, 200);
  }
  if (facts.symptoms.length > 0) {
    return facts.symptoms.slice(0, 2).join(" ").slice(0, 200);
  }
  return null;
}

/**
 * Retrieve medical references with a hard time budget. Never throws, never
 * blocks safety or product cards, and returns [] on any failure or timeout.
 */
async function retrieveMedicalReferencesBounded(
  query: string,
): Promise<MedicalReference[]> {
  try {
    const result = await Promise.race([
      searchMedicalReferences({ query, filter: "all", limit: 6 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return result ? result.results.slice(0, 5) : [];
  } catch {
    return [];
  }
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

/**
 * Localize a leaf-category name without blocking the response. Translation is
 * a network call on a cold cache, so a slow translation falls back to the raw
 * stored name rather than delaying product cards.
 */
async function localizeCategorySafe(
  category: { name: string } | undefined,
  language: LanguageCode,
): Promise<string | null> {
  if (!category) return null;
  if (language === "fa") return category.name;

  try {
    return await Promise.race([
      localizeCategoryName(category, language),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(category.name), 700);
      }),
    ]);
  } catch {
    return category.name;
  }
}

const LATIN_ONLY = /^[\x00-\x7F\s]*$/;

/**
 * English display-name fallback for listing-only products. Darukade exposes
 * the English name only on the detail page, so when enrichment exceeds its
 * budget (common on a cold production instance) the card would otherwise show
 * the Persian `name`. This is a bounded, cached display translation — it never
 * changes the verified source fields and never blocks the stream.
 */
async function localizeProductNameSafe(
  name: string,
  language: LanguageCode,
): Promise<string | null> {
  if (language !== "en") return null;
  const trimmed = name.trim();
  if (!trimmed || LATIN_ONLY.test(trimmed)) return null;

  try {
    return await Promise.race([
      translateFaToEnBounded(trimmed, 1_200),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1_400);
      }),
    ]);
  } catch {
    return null;
  }
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

  // Deterministic red flags surface instantly. A caution result is held back
  // while the model is available: the model can escalate it to urgent, and a
  // "more information needed" warning must not flash right before the real
  // red flag appears.
  let safetyEventSent = false;
  if (shouldSendInstantSafety(instantSafety, isDeepSeekConfigured())) {
    send({
      type: "safety",
      safety: {
        ...instantSafety,
        deterministicOnly: !isDeepSeekConfigured(),
      },
    });
    safetyEventSent = true;
  }
  mark("safetyInstant");

  // ── Step 2: interpretation and provisional retrieval run together.
  // Retrieval always runs, even for a possible red flag: product suggestions
  // are never withheld, and the safety alert is emitted separately below. ──
  stage("interpreting");
  const [interpretation, earlyRetrieval] = await Promise.all([
    interpretCase({ message, history, signal, memory: memoryState }),
    retrieveProducts({
      facts: instantFacts,
      message,
      language,
      provisional: true,
      signal,
      dependencies: {
        localizeCategory: localizeCategorySafe,
        localizeProductName: localizeProductNameSafe,
      },
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
    // Current-turn search intent must come from this turn's interpretation,
    // never from the accumulated query history in memory (which is context,
    // not intent). `searchTerms` stays the accumulated symptom history as a
    // deterministic fallback when the model produced no product queries.
    productQueries: facts.productQueries,
  };

  // Allergy-only caution concerns do not gate: the deterministic ingredient
  // filter already enforces them on every candidate.
  const modelConcerns = interpretation.safetyConcerns.filter(
    (concern) => !isAllergyOnlyConcern(concern, caseFacts),
  );

  const safety: SafetyAssessment = {
    ...applyModelFollowUpQuestions(
      applyModelConcerns(assessSafety(caseFacts, message), modelConcerns),
      interpretation.followUpQuestions,
    ),
    deterministicOnly: interpretation.fallback,
  };

  // The safety event goes out first — before the memory write and before any
  // retrieval work — so an escalation reaches the pharmacist as fast as the
  // interpretation completes.
  const shouldShowSafety =
    safety.status !== "LOWER_RISK" || caseFacts.symptoms.length > 0;
  const plannedSafety = planSafetyEvent({
    instantSafety,
    instantEventSent: safetyEventSent,
    safety,
    shouldShow: shouldShowSafety,
  });
  if (plannedSafety) {
    send({ type: "safety", safety: plannedSafety });
  }
  mark("safety");

  send({ type: "memory", memory: updatedMemory });
  await onMemory?.(updatedMemory);
  mark("memory");

  // Medical reference retrieval runs in parallel with product retrieval. It is
  // bounded (4s) and never blocks the safety alert or the product cards.
  const medicalQuery = buildMedicalQuery(message, caseFacts);
  const medicalRefsPromise = medicalQuery
    ? retrieveMedicalReferencesBounded(medicalQuery)
    : Promise.resolve<MedicalReference[]>([]);

  // ── Step 4: retrieval — product cards are never safety-gated ──
  stage("retrieving");
  const retrievalStartedAt = Date.now();
  let products: ProductRecommendation[] = earlyRetrieval?.products ?? [];
  let databaseAvailable = earlyRetrieval?.databaseAvailable ?? true;
  let retrievalQueries = earlyRetrieval?.queries ?? [];
  let retrievalScope: ShoppingIntent = earlyRetrieval?.scope ?? "general";
  let missingIngredientData = earlyRetrieval?.missingIngredientData ?? false;
  let retrievalOutcome = earlyRetrieval?.outcome ?? null;
  const excluded: PipelineDiagnostics["retrieval"]["excluded"] = [];
  const earlyCandidateCount = earlyRetrieval?.outcome?.candidatesFound ?? 0;
  let refinedCandidateCount = 0;
  let refinedProductIds: string[] = [];
  let passCount = 0;
  let rejectCount = 0;

  const recordDecisions = (result: ProductRetrievalResult) => {
    retrievalQueries = result.queries.length
      ? result.queries
      : retrievalQueries;
    retrievalScope = result.scope;
    missingIngredientData = result.missingIngredientData;
    retrievalOutcome = result.outcome;
    for (const verdict of result.decisions) {
      if (verdict.pass) passCount += 1;
      else rejectCount += 1;
      if (!verdict.pass && verdict.code) {
        excluded.push({
          productId: verdict.productId,
          code: verdict.code,
          matchLevel: verdict.matchLevel ?? null,
        });
      }
    }
  };
  if (earlyRetrieval) recordDecisions(earlyRetrieval);

  // The model's product queries drive a refined AI search. Without them we
  // keep the (already relevance-gated) early results.
  const hasAiQueries = caseFacts.productQueries.length > 0;

  if (hasAiQueries || products.length < 3) {
    const refined = await retrieveProducts({
      facts: caseFacts,
      message,
      language,
      provisional: false,
      signal,
      dependencies: {
        localizeCategory: localizeCategorySafe,
        localizeProductName: localizeProductNameSafe,
      },
    });
    recordDecisions(refined);
    refinedCandidateCount = refined.outcome?.candidatesFound ?? 0;
    refinedProductIds = refined.products.map((item) => item.product.id);
    // Candidate pooling, not replacement: refined (AI) hits and early
    // (symptom-driven) hits are combined by product id and re-ranked, so a
    // weak AI query can never discard a stronger early candidate.
    products = poolProductRecommendations(products, refined.products, 6);
    databaseAvailable = databaseAvailable && refined.databaseAvailable;
  }

  const retrievalLatencyMs = Date.now() - retrievalStartedAt;

  // Anything below `routine` is flagged provisional so the UI nudges the
  // pharmacist to read the safety alert — the cards still show.
  products = products.map((item) => ({
    ...item,
    provisional: safety.level !== "routine",
  }));

  const productQueriesUsed =
    caseFacts.productQueries.length > 0
      ? caseFacts.productQueries.slice(0, 3)
      : buildProductQueriesForFacts(caseFacts);

  const emission = planProductEmission({
    safety,
    products,
    databaseAvailable,
    queries: productQueriesUsed,
    intent: retrievalScope,
  });

  send({
    type: "products",
    products: emission.products,
    provisional: emission.provisional,
    databaseAvailable: emission.databaseAvailable,
    queries: emission.queries,
    suppressed: emission.suppressed,
    gateReason: emission.gateReason ?? undefined,
    intent: emission.intent,
    displayPolicy: emission.displayPolicy,
  });
  mark("database");

  // Emit source-backed medical references for this turn (may be empty).
  const medicalReferences = await medicalRefsPromise;
  if (medicalReferences.length > 0) {
    send({ type: "references", references: medicalReferences });
  }

  // ── Step 5: stream the explanation ────────────────────────────
  stage("composing");

  const runFallback = async (extraNote?: string) => {
    let text = buildFallbackResponse({
      facts: caseFacts,
      safety,
      products,
    });
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
        content: buildResponseUserPrompt({
          message,
          facts: caseFacts,
          safety,
          products,
          displayPolicy: emission.displayPolicy,
          references: medicalReferences,
        }),
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

  // Structured diagnostics: rule ids, product ids and machine-readable codes
  // only — never user content.
  const reportTimings: PipelineTimings = {
    received: timings["received"] ?? 0,
    interpreted: timings["interpreted"] ?? 0,
    safety: timings["safety"] ?? 0,
    database: timings["database"] ?? 0,
    firstToken: timings["firstToken"] ?? 0,
    done: timings["done"] ?? 0,
  };
  const report: PipelineReport = {
    timings: reportTimings,
    diagnostics: {
      safety: {
        rulesetVersion: safety.rulesetVersion,
        level: safety.level,
        permission: safety.recommendationPermission,
        triggers: safety.triggers,
        deterministicOnly: Boolean(safety.deterministicOnly),
        modelConcerns: safety.modelConcerns.length,
        findings: safety.findings.map((finding) => ({
          id: finding.id,
          status: finding.status,
        })),
        unansweredQuestions: safety.findings
          .filter((finding) => finding.status === "unknown")
          .map((finding) => finding.id),
      },
      retrieval: {
        databaseAvailable,
        queries: retrievalQueries,
        scope: retrievalScope,
        candidates: products.length + excluded.length,
        kept: products.length,
        excluded,
        missingIngredientData,
        displayPolicy: emission.displayPolicy,
        outcome: retrievalOutcome,
        queryCount: retrievalQueries.length,
        earlyCandidates: earlyCandidateCount,
        refinedCandidates: refinedCandidateCount,
        mergedCandidates: new Set([
          ...(earlyRetrieval?.products ?? []).map((item) => item.product.id),
          ...refinedProductIds,
        ]).size,
        passCount,
        rejectCount,
        topCandidates: products.slice(0, 3).map((item) => ({
          id: item.product.id,
          score: item.score,
          reason: item.reason,
        })),
        finalProductIds: products.map((item) => item.product.id),
        noProductsReason:
          products.length === 0
            ? databaseAvailable
              ? excluded.length > 0
                ? `no_candidates_passed: ${excluded.length} rejected`
                : "no_candidates_found"
              : "catalog_unavailable"
            : null,
        partialFailure: (retrievalOutcome?.failedQueries ?? 0) > 0,
        retrievalLatencyMs,
      },
      timings: reportTimings,
    },
  };
  log?.(report);
}
