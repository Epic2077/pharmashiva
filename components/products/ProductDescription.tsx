"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductDescriptionProps {
  text: string;
}

/** Clamp the description to 3 lines with a "More…" / "Show less" toggle. */
export default function ProductDescription({ text }: ProductDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  // Only offer the toggle when the text is long enough to be clamped.
  const canExpand = text.length > 140 || text.includes("\n");
  const clamped = canExpand && !expanded;

  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          "whitespace-pre-line text-sm leading-relaxed text-foreground/90",
          clamped && "line-clamp-3",
        )}
      >
        {text}
      </p>

      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-fit text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {expanded ? "Show less" : "More…"}
        </button>
      ) : null}
    </div>
  );
}
