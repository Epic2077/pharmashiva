"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Package, Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";
import { addRecentSearch } from "@/lib/search/recent";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SuggestionProduct {
  id: number;
  name: string;
  brand: string | null;
  image: string | null;
  url: string;
}

interface SuggestionEntry {
  title: string;
  url: string;
  icon: string | null;
  kind: "brand" | "group" | "other";
}

interface Suggestions {
  products: SuggestionProduct[];
  entries: SuggestionEntry[];
}

const EMPTY_SUGGESTIONS: Suggestions = { products: [], entries: [] };

type SuggestionItem =
  | { key: string; type: "product"; product: SuggestionProduct }
  | { key: string; type: "entry"; entry: SuggestionEntry };

interface SearchBarProps {
  resultCount?: number;
}

export default function SearchBar({ resultCount }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [value, setValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  const [isPending, startTransition] = useTransition();

  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY_SUGGESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Keep the input in sync when the URL changes externally (popular chips,
  // back/forward). Adjusting state during render avoids an extra effect render.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setValue(query);
    setSuggestions(EMPTY_SUGGESTIONS);
    setLoadingSuggestions(false);
    setActiveIndex(-1);
  }

  const items: SuggestionItem[] = [
    ...suggestions.products.map((product) => ({
      key: `p-${product.id}`,
      type: "product" as const,
      product,
    })),
    ...suggestions.entries.map((entry) => ({
      key: `e-${entry.url}-${entry.title}`,
      type: "entry" as const,
      entry,
    })),
  ];

  // Debounced suggestions fetch while the user types. State is only updated
  // inside the async callback so this effect never re-renders synchronously.
  useEffect(() => {
    const term = value.trim();
    if (!term || term === query) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggestions?w=${encodeURIComponent(term)}`,
        );
        const data: Suggestions = response.ok
          ? ((await response.json()) as Suggestions)
          : EMPTY_SUGGESTIONS;
        if (active) {
          setSuggestions(data);
          setActiveIndex(-1);
        }
      } catch {
        if (active) setSuggestions(EMPTY_SUGGESTIONS);
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, query]);

  function blurInput() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function go(raw: string) {
    const q = raw.trim();
    if (q) addRecentSearch(q);
    blurInput();
    setOpen(false);
    setValue(q);

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    // Keep the selected category filter across searches.
    const category = searchParams.get("cat");
    if (category) params.set("cat", category);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/search?${qs}` : "/search");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(value);
  }

  function selectItem(item: SuggestionItem) {
    if (item.type === "product") {
      const { product } = item;
      blurInput();
      setOpen(false);
      setValue(product.name);
      const href = `/search/products/${product.id}${
        product.url ? `?url=${encodeURIComponent(product.url)}` : ""
      }`;
      router.push(href);
      return;
    }
    go(item.entry.title);
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
      selectItem(items[activeIndex]);
    }
  }

  const showDropdown =
    open &&
    value.trim().length > 0 &&
    (loadingSuggestions || items.length > 0);

  return (
    <div className="relative mx-auto w-[95%]">
      <form
        role="search"
        className="flex items-center gap-3"
        onSubmit={handleSubmit}
      >
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
            aria-label="Search products"
            placeholder="Search by name, ingredient, or category…"
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              setOpen(true);
              setActiveIndex(-1);
              const trimmed = next.trim();
              if (!trimmed || trimmed === query) {
                setSuggestions(EMPTY_SUGGESTIONS);
                setLoadingSuggestions(false);
              } else {
                setLoadingSuggestions(true);
              }
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
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ArrowRight className="size-3" />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {resultCount !== undefined && resultCount > 0 ? (
          <Badge
            variant="outline"
            className="h-8 w-8 shrink-0 justify-center rounded-2xl text-xs font-semibold"
          >
            {resultCount}
          </Badge>
        ) : null}
      </form>

      {showDropdown ? (
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg"
        >
          {loadingSuggestions && items.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching suggestions…
            </div>
          ) : null}

          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(item);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                index === activeIndex && "bg-muted/60",
              )}
            >
              {item.type === "product" ? (
                <>
                  {item.product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.image}
                      alt=""
                      loading="lazy"
                      className="size-9 shrink-0 rounded-lg border border-border bg-background object-contain"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <Package className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.product.name}
                    </span>
                    {item.product.brand ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.product.brand}
                      </span>
                    ) : null}
                  </span>
                </>
              ) : (
                <>
                  {item.entry.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.entry.icon}
                      alt=""
                      loading="lazy"
                      className="size-9 shrink-0 rounded-lg border border-border bg-background object-contain"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <Search className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.entry.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.entry.kind === "brand"
                        ? "Brand"
                        : item.entry.kind === "group"
                          ? "Category"
                          : "Suggested search"}
                    </span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
