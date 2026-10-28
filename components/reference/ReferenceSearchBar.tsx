"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/lib/i18n";
import {
  popularReferenceTerms,
  REFERENCE_FILTER_LABEL,
  suggestReferenceTerms,
  type ReferenceSuggestion,
} from "@/lib/medical-reference/suggestions";

interface ReferenceSearchBarProps {
  initialQuery?: string;
  /** UI language: switches suggestion labels between English and Farsi. */
  language?: LanguageCode;
}

/**
 * Search input for the Medical Reference section with a curated autocomplete
 * dropdown. Submits to `/reference?q=…`, preserving the active filter on a
 * plain submit and using the suggestion's own category when one is selected.
 */
export function ReferenceSearchBar({
  initialQuery = "",
  language = "en",
}: ReferenceSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const popular = popularReferenceTerms();
  const items = value.trim() ? suggestReferenceTerms(value) : popular;

  function go(query: string, filter?: string) {
    setOpen(false);
    setValue(query);
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set("q", q);
    if (filter && filter !== "all") params.set("filter", filter);
    const qs = params.toString();
    router.push(qs ? `/reference?${qs}` : "/reference");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filter = searchParams.get("filter") ?? undefined;
    go(value, filter);
  }

  function selectSuggestion(suggestion: ReferenceSuggestion) {
    // Submit the canonical English term: it is what the sources understand,
    // avoiding a translation round-trip for a term we already know.
    go(suggestion.label, suggestion.filter);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < items.length - 1 ? current + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : items.length - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(items[activeIndex]!);
    }
  }

  const showDropdown = open && items.length > 0;

  return (
    <div className="relative">
      <form role="search" className="flex items-center gap-3" onSubmit={submit}>
        <InputGroup className="h-12 flex-1 rounded-2xl">
          <InputGroupAddon align="inline-start" className="pl-3.5">
            <Search className="size-5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Search medical reference"
            placeholder="Search conditions, drugs, ingredients, research…"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so a click/tap on a suggestion registers before closing.
              setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
          />
          <InputGroupAddon align="inline-end" className="pr-2">
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label="Search"
              className="rounded-full"
            >
              <ArrowRight className="size-3" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {showDropdown ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg">
          {!value.trim() ? (
            <div className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Popular searches
            </div>
          ) : null}
          {items.map((suggestion, index) => (
            <button
              key={suggestion.label}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                index === activeIndex && "bg-muted/60",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Search className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {language === "fa" && suggestion.fa
                  ? suggestion.fa
                  : suggestion.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {REFERENCE_FILTER_LABEL[suggestion.filter][language]}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
