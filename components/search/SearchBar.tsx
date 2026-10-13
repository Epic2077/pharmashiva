"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Badge } from "../ui/badge";

interface SearchBarProps {
  defaultValue?: string;
  resultCount?: number;
}

export default function SearchBar({
  defaultValue = "",
  resultCount,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
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
          onChange={(event) => setValue(event.target.value)}
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
