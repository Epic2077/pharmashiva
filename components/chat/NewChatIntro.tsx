"use client";

import { useChatSession } from "@/lib/chat/use-chat-session";
import Logo from "../shared/Logo";
import SuggestionButton from "../shared/SuggestionButton";

const suggestions = [
  "What can I take for a headache?",
  "Drug Interaction check",
  "Side effects of metformin",
  "Is paracetamol safe during pregnancy?",
];

export function NewChatIntro() {
  const { send } = useChatSession();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4 bg-accent rounded-lg w-full p-6">
        <Logo
          size="medium"
          className="flex flex-row gap-4 items-center justify-center w-20 h-10"
        />
        <p className="text-accent-foreground text-sm font-medium">
          Hi, I&apos;m your AI assistant, ask anything about supplements,
          symptoms and more.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        {suggestions.map((suggestion) => (
          <SuggestionButton
            key={suggestion}
            suggestion={suggestion}
            onClick={() => send(suggestion)}
          />
        ))}
      </div>
    </div>
  );
}
