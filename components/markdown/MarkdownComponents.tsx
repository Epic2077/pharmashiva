import React, { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { stackoverflowLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { stackoverflowDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import Image from "next/image";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Loader2,
  PackageSearch,
  Play,
  ShieldCheck,
} from "lucide-react";
import type { CodeExecutionResult } from "@/types/chat";

const RUNNABLE_LANGUAGES = new Set(["javascript", "js", "python", "py"]);

interface MarkdownComponentOptions {
  theme?: string;
  onRunCode?: (
    code: string,
    language: string,
    onStatus?: (status: string) => void,
  ) => Promise<CodeExecutionResult>;
}

type MarkdownNodeProps = {
  children?: React.ReactNode;
  className?: string;
};

function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }
  return "";
}

/**
 * Special blockquotes become Shiva-style callout cards when their first text
 * starts with one of these markers:
 *   🚨 / RED FLAG / SAFETY:
 *   💊 / PRODUCT / PRODUCTS:
 *   ✅ / CLEARED:
 *   ℹ️ / INFO:
 *
 * Ordinary Markdown blockquotes remain ordinary quotes.
 */
function MarkdownBlockquote({ children }: MarkdownNodeProps) {
  const content = getTextContent(children).trim().toLowerCase();

  const isDanger =
    content.startsWith("🚨") ||
    content.startsWith("red flag") ||
    content.startsWith("safety:");
  const isProduct =
    content.startsWith("💊") ||
    content.startsWith("product:") ||
    content.startsWith("products:");
  const isSuccess =
    content.startsWith("✅") || content.startsWith("cleared:");
  const isInfo = content.startsWith("ℹ️") || content.startsWith("info:");

  if (isDanger) {
    return (
      <aside
        role="alert"
        className="my-4 overflow-hidden rounded-2xl border border-danger/25 bg-danger-background text-foreground shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-danger/15 px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>Safety alert</span>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm leading-6 [&>p:first-child]:font-medium [&>ul]:mt-2 [&>ol]:mt-2">
          {children}
        </div>
      </aside>
    );
  }

  if (isProduct) {
    return (
      <section className="my-4 overflow-hidden rounded-2xl border border-primary/20 bg-card text-card-foreground shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
          <PackageSearch size={17} aria-hidden="true" />
          <span>Product suggestions</span>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm leading-6 [&>ul]:mt-2 [&>ol]:mt-2">
          {children}
        </div>
      </section>
    );
  }

  if (isSuccess) {
    return (
      <aside className="my-4 rounded-2xl border border-success/25 bg-success-background px-4 py-3 text-sm leading-6 text-foreground">
        <div className="mb-1 flex items-center gap-2 font-semibold text-success">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Safety update</span>
        </div>
        {children}
      </aside>
    );
  }

  if (isInfo) {
    return (
      <aside className="my-4 rounded-2xl border border-info/25 bg-info-background px-4 py-3 text-sm leading-6 text-foreground">
        <div className="mb-1 flex items-center gap-2 font-semibold text-info">
          <Info size={17} aria-hidden="true" />
          <span>Information</span>
        </div>
        {children}
      </aside>
    );
  }

  return (
    <blockquote className="my-5 border-l-2 border-primary/50 pl-4 text-muted-foreground [&>p]:my-2">
      {children}
    </blockquote>
  );
}

export function createMarkdownComponents({
  theme = "light",
  onRunCode,
}: MarkdownComponentOptions) {
  return {
    div: ({ children }: MarkdownNodeProps) => (
      <div className="my-3 rounded-xl bg-muted/60 px-4 py-3">{children}</div>
    ),

    h1: ({ children }: MarkdownNodeProps) => (
      <h1 className="mb-4 mt-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {children}
      </h1>
    ),
    h2: ({ children }: MarkdownNodeProps) => (
      <h2 className="mb-3 mt-7 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {children}
      </h2>
    ),
    h3: ({ children }: MarkdownNodeProps) => (
      <h3 className="mb-2 mt-6 text-lg font-semibold tracking-tight text-foreground">
        {children}
      </h3>
    ),
    h4: ({ children }: MarkdownNodeProps) => (
      <h4 className="mb-2 mt-4 text-base font-semibold text-foreground">
        {children}
      </h4>
    ),
    h5: ({ children }: MarkdownNodeProps) => (
      <h5 className="mb-2 mt-4 text-sm font-semibold text-foreground">
        {children}
      </h5>
    ),
    h6: ({ children }: MarkdownNodeProps) => (
      <h6 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h6>
    ),

    p: ({ children }: MarkdownNodeProps) => (
      <p className="mb-3 text-sm leading-7 text-foreground/90 last:mb-0">
        {children}
      </p>
    ),

    bold: ({ children }: MarkdownNodeProps) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    strong: ({ children }: MarkdownNodeProps) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    i: ({ children }: MarkdownNodeProps) => (
      <em className="text-foreground/90">{children}</em>
    ),
    em: ({ children }: MarkdownNodeProps) => (
      <em className="text-foreground/90">{children}</em>
    ),
    u: ({ children }: MarkdownNodeProps) => (
      <u className="underline decoration-primary/50 underline-offset-4">
        {children}
      </u>
    ),

    mark: ({ children }: MarkdownNodeProps) => (
      <mark className="rounded bg-warning-background px-1 py-0.5 text-foreground">
        {children}
      </mark>
    ),

    del: ({ children }: MarkdownNodeProps) => (
      <del className="text-muted-foreground line-through">{children}</del>
    ),

    blockquote: MarkdownBlockquote,

    ul: ({ children }: MarkdownNodeProps) => (
      <ul className="mb-4 ml-5 list-disc space-y-2 marker:text-primary [&>li]:pl-1">
        {children}
      </ul>
    ),
    ol: ({ children }: MarkdownNodeProps) => (
      <ol className="mb-4 ml-5 list-decimal space-y-2 marker:font-semibold marker:text-primary [&>li]:pl-1">
        {children}
      </ol>
    ),
    li: ({ children }: MarkdownNodeProps) => (
      <li className="pl-0.5 text-sm leading-6 text-foreground/90">{children}</li>
    ),

    hr: () => <hr className="my-7 border-border" />,

    table: ({ children }: MarkdownNodeProps) => (
      <div className="my-5 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: MarkdownNodeProps) => (
      <thead className="bg-muted/70 text-foreground">{children}</thead>
    ),
    th: ({
      children,
      align,
    }: {
      children?: React.ReactNode;
      align?: string | null;
    }) => (
      <th
        className={`border-b border-border px-4 py-3 font-semibold ${
          align === "center"
            ? "text-center"
            : align === "right"
              ? "text-right"
              : "text-left"
        }`}
      >
        {children}
      </th>
    ),
    td: ({
      children,
      align,
    }: {
      children?: React.ReactNode;
      align?: string | null;
    }) => (
      <td
        className={`border-b border-border px-4 py-3 align-top text-foreground/90 last:border-b-0 ${
          align === "center"
            ? "text-center"
            : align === "right"
              ? "text-right"
              : "text-left"
        }`}
      >
        {children}
      </td>
    ),

    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const safeHref =
        href && /^(https?:|mailto:|\/|#)/i.test(href) ? href : undefined;

      return (
        <a
          href={safeHref}
          target={safeHref?.startsWith("http") ? "_blank" : undefined}
          rel={safeHref?.startsWith("http") ? "noopener noreferrer" : undefined}
          className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:decoration-primary"
        >
          {children}
        </a>
      );
    },

    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
      const { alt = "", src } = props;
      if (!src) return null;

      return (
        <div className="my-5 overflow-hidden rounded-2xl border border-border bg-card">
          <Image
            src={String(src)}
            alt={alt}
            width={800}
            height={600}
            className="h-auto max-h-[520px] w-full object-contain"
            unoptimized
          />
        </div>
      );
    },

    kbd: ({ children }: MarkdownNodeProps) => (
      <KbdGroup>
        <Kbd>{children}</Kbd>
      </KbdGroup>
    ),

    code({
      inline,
      children,
    }: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
    }) {
      if (inline) {
        return (
          <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-primary">
            {children}
          </code>
        );
      }
      return <code>{children}</code>;
    },

    pre({ children }: MarkdownNodeProps) {
      const child = React.Children.only(children) as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      const className = child.props.className || "";
      const match = /language-([\w-]+)/.exec(className);
      const language = match ? match[1] : "text";
      const codeText = String(child.props.children ?? "").replace(/\n$/, "");
      const isRunnable = Boolean(
        onRunCode && RUNNABLE_LANGUAGES.has(language.toLowerCase()),
      );

      return (
        <CodeBlockWithActions
          language={language}
          codeText={codeText}
          theme={theme}
          runnable={isRunnable}
          onRunCode={onRunCode}
        />
      );
    },
  };
}

function CodeBlockWithActions({
  language,
  codeText,
  theme,
  runnable,
  onRunCode,
}: {
  language: string;
  codeText: string;
  theme: string;
  runnable: boolean;
  onRunCode?: (
    code: string,
    language: string,
    onStatus?: (status: string) => void,
  ) => Promise<CodeExecutionResult>;
}) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("Running…");
  const [execResult, setExecResult] = useState<CodeExecutionResult | null>(
    null,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in insecure contexts or restricted browsers.
    }
  };

  const handleRun = async () => {
    if (!onRunCode || running) return;

    setRunning(true);
    setExecResult(null);
    setStatusText("Running…");

    try {
      const result = await onRunCode(codeText, language, setStatusText);
      setExecResult(result);
    } catch {
      setExecResult({
        code: codeText,
        language,
        output: "",
        error: "Execution request failed",
        executionTime: 0,
      });
    } finally {
      setRunning(false);
      setStatusText("Running…");
    }
  };

  return (
    <div
      dir="ltr"
      className="group/code my-5 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="font-mono font-medium">{language}</span>
        <div className="flex items-center gap-1">
          {runnable && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Run code"
            >
              {running ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              <span>{running ? statusText : "Run"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check size={14} className="text-success" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <SyntaxHighlighter
        language={language}
        style={theme === "dark" ? stackoverflowDark : stackoverflowLight}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "16px",
          fontSize: "0.875rem",
          lineHeight: 1.7,
          direction: "ltr",
          textAlign: "left",
          background: "transparent",
          overflowX: "auto",
        }}
      >
        {codeText}
      </SyntaxHighlighter>

      {execResult && (
        <div className="border-t border-border">
          {execResult.output && (
            <div className="bg-success-background/50 px-4 py-3">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-success">
                {execResult.output}
              </pre>
            </div>
          )}
          {execResult.error && (
            <div className="bg-danger-background px-4 py-3">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-danger">
                {execResult.error}
              </pre>
            </div>
          )}
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            Executed in {execResult.executionTime} ms
          </div>
        </div>
      )}
    </div>
  );
}
