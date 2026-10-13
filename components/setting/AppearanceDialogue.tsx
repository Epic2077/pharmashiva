"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: Theme;
  label: string;
  description: string;
  icon: ReactElement;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme",
    icon: <SunIcon className="size-4" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme",
    icon: <MoonIcon className="size-4" />,
  },
  {
    value: "system",
    label: "System",
    description: "Match your device settings",
    icon: <MonitorIcon className="size-4" />,
  },
];

interface AppearanceDialogueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AppearanceDialogue({
  open,
  onOpenChange,
}: AppearanceDialogueProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80%] gap-5 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            Choose how PharmaShiva looks on this device.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex flex-col gap-2"
        >
          {OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {option.description}
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
