"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatComposerProps {
  placeholder: string;
  isStreaming: boolean;
  onSubmit: (prompt: string) => void;
  onStop: () => void;
}

export function ChatComposer({
  placeholder,
  isStreaming,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const [prompt, setPrompt] = useState("");

  const canSubmit = prompt.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(prompt.trim());
    setPrompt("");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="flex items-center gap-2 rounded-full border border-input bg-card p-2 pl-3 shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    >
      <Input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={placeholder}
        aria-label="Message"
        className="h-9 border-0 bg-transparent px-1 focus-visible:ring-0"
      />
      {isStreaming ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onStop}
          aria-label="Stop generating"
        >
          <Square className="size-3 fill-current rounded-full cursor-pointer" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!canSubmit}
          aria-label="Send message"
          className="rounded-full rotate-45 cursor-pointer"
        >
          <ArrowUp />
        </Button>
      )}
    </form>
  );
}
