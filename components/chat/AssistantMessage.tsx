"use client";

import { motion } from "motion/react";
import type { Message } from "@/lib/chat/types";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import Logo from "@/components/shared/Logo";
import { useLanguage } from "@/hooks/use-language";
import { TypingIndicator } from "./TypingIndicator";
import ThinkingBlock from "./ThinkingBlock";
import { SafetyAlert } from "./SafetyAlert";
import { ChatProductList } from "./ChatProductList";

interface AssistantMessageProps {
  message: Message;
  isStreaming: boolean;
}

export function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  const { language } = useLanguage();

  const isEmpty = message.content.length === 0;
  const hasThinking = Boolean(message.thinking && message.thinking.length > 0);
  const showThinking = hasThinking || Boolean(message.thinkingStreaming);

  // Client-side enforcement: even if a stale or malformed event carried
  // product cards, a safety assessment that does not allow recommendations
  // must suppress them here too.
  const safetyAllowsProducts =
    !message.safety || message.safety.recommendationPermission === "allowed";
  const productsSuppressed =
    Boolean(message.productsSuppressed) || !safetyAllowsProducts;
  const gateReason = message.productsGateReason ?? "safety_restricted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="text-bases leading-relaxed wrap-break-words text-foreground mt-5"
    >
      <div className="flex flex-col gap-2 text-left">
        {/* self-start keeps the logo left-aligned without shrinking the text */}
        <Logo size="small" className="self-start floating-component" />

        {/* Reasoning is shown separately from the answer, in an expandable block. */}
        {showThinking ? (
          <ThinkingBlock
            thinking={message.thinking ?? ""}
            streaming={Boolean(message.thinkingStreaming && isStreaming)}
          />
        ) : null}

        {/* Immediate "thinking" state until the first tokens arrive. */}
        {isEmpty && isStreaming && !showThinking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TypingIndicator />
            {message.status ? <span>{message.status}</span> : null}
          </div>
        ) : null}

        {/* The authoritative safety result, independent of the answer text. */}
        {message.safety ? <SafetyAlert safety={message.safety} /> : null}

        {/* Database-backed product cards, using the existing product component. */}
        {message.products ? (
          <ChatProductList
            products={message.products}
            language={language}
            provisional={Boolean(message.productsProvisional)}
            databaseAvailable={message.productsDatabaseAvailable ?? true}
            suppressed={productsSuppressed}
            gateReason={gateReason}
          />
        ) : null}

        {message.content ? (
          <>
            <MarkdownRenderer>{message.content}</MarkdownRenderer>
            {isStreaming ? (
              <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle" />
            ) : null}
          </>
        ) : null}

        {message.error ? (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-background px-3 py-2 text-sm text-foreground/90"
          >
            {message.error}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
