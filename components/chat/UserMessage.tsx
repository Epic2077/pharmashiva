"use client";

import { motion } from "motion/react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import type { Message } from "@/lib/chat/types";

export function UserMessage({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col"
    >
      <Bubble variant="default" align="end">
        <BubbleContent className="whitespace-pre-wrap break-words">
          {message.content}
        </BubbleContent>
      </Bubble>
    </motion.div>
  );
}
