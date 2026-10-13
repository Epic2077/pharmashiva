"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Badge } from "../ui/badge";

interface SearchBarProps {
  resultCount?: number;
}

const DEBOUNCE_MS = 250;

export default function SearchBar({ resultCount }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [value, setValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL changes externally (popular chips).
  // Adjusting state during render avoids an extra effect render.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setValue(query);
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function navigate(next: string) {
    const q = next.trim();
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  return (
    <form className="flex items-center gap-3" onSubmit={handleSubmit}>
      <InputGroup className="h-12 flex-1 rounded-2xl">
        <InputGroupAddon align="inline-start" className="pl-3.5">
          <Search className="size-5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          name="q"
          placeholder="Search medicines & supplements…"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
        />
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
