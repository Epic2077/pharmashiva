"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

interface ReferenceSearchBarProps {
  initialQuery?: string;
}

/**
 * Minimal search input for the Medical Reference section. Submits to
 * `/reference?q=…`, preserving the active filter so a refined search stays
 * in its category.
 */
export function ReferenceSearchBar({ initialQuery = "" }: ReferenceSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const filter = searchParams.get("filter");
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    router.push(qs ? `/reference?${qs}` : "/reference");
  }

  return (
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
          onChange={(event) => setValue(event.target.value)}
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
  );
}
