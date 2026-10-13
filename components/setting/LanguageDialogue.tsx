"use client";

import { CheckIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { LANGUAGES, useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

interface LanguageDialogueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LanguageDialogue({
  open,
  onOpenChange,
}: LanguageDialogueProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80%] gap-5 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Language</DialogTitle>
          <DialogDescription>
            Select the language used across the app.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Language"
          className="flex flex-col gap-1"
        >
          {LANGUAGES.map((option) => {
            const selected = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLanguage(option.code)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-primary/5" : "hover:bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {option.native}
                  </span>
                </span>
                {selected && <CheckIcon className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
