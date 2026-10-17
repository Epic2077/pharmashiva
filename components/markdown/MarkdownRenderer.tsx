"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createMarkdownComponents } from "./MarkdownComponents";

interface MarkdownRendererProps {
  children: string;
  theme?: "light" | "dark";
}

/** Renders assistant replies as markdown using the shared component map. */
export function MarkdownRenderer({
  children,
  theme = "light",
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={createMarkdownComponents({ theme })}
    >
      {children}
    </ReactMarkdown>
  );
}
