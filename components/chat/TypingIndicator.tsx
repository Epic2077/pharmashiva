import { motion } from "motion/react";
import { Marker, MarkerContent } from "@/components/ui/marker";

const DOTS = [0, 1, 2];

export function TypingIndicator() {
  return (
    <Marker aria-label="Assistant is typing" role="status">
      <MarkerContent className="flex items-center gap-1.5">
        {DOTS.map((dot) => (
          <motion.span
            key={dot}
            className="size-1.5 rounded-full bg-current"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
          />
        ))}
      </MarkerContent>
    </Marker>
  );
}
