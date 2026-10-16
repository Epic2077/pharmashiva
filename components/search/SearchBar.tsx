"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";
import { Badge } from "../ui/badge";

interface SearchBarProps {
  resultCount?: number;
}

export default function SearchBar({ resultCount }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [value, setValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);

  // Keep the input in sync when the URL changes externally (popular chips,
  // back/forward). Adjusting state during render avoids an extra effect render.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setValue(query);
  }

  // Searching only happens on submit (Enter / the Go-Search key / the button).
  // Live, debounced navigation re-mounted this input on every keystroke, which
  // dropped focus and scrambled typing on iOS Safari.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();

    // Dismiss the mobile keyboard once the search is triggered.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form role="search" className="flex items-center gap-3" onSubmit={handleSubmit}>
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
          onChange={(event) => setValue(event.target.value)}
        />
        <InputGroupAddon align="inline-end" className="pr-1.5">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            aria-label="Search"
          >
            <ArrowRight className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {resultCount !== undefined && resultCount > 0 ? (
        <Badge
          variant="outline"
          className="h-12 w-12 shrink-0 justify-center rounded-2xl text-sm font-semibold"
        >
          {resultCount}
        </Badge>
      ) : null}
    </form>
  );
}
