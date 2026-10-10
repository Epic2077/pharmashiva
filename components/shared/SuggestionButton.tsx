import { Button } from "../ui/button";

interface SuggestionButtonProps {
  suggestion: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export default function SuggestionButton({
  suggestion,
  onClick,
}: SuggestionButtonProps) {
  return (
    <Button
      variant={"ghost"}
      onClick={onClick}
      className="rounded-full border-accent-foreground px-4 py-5 text-sm font-medium"
    >
      <p>{suggestion}</p>
    </Button>
  );
}
