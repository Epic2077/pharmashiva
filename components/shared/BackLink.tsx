"use client";

import { ArrowLeft, PlusCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";

interface BackLinkProps {
  title?: string;
  subtitle?: string;
  link?: string;
}

export default function BackLink({ title, subtitle, link }: BackLinkProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Any route under a "chat" segment gets the new-chat affordance instead of a
  // back arrow: going back from a chat means starting another case.
  const isChatRoute =
    (pathname ?? "").split("/").includes("chat") || link === "/home/chat";

  return (
    <div className="flex gap-4 items-center cursor-pointer">
      <button
        type="button"
        aria-label={isChatRoute ? "New chat" : "Go back"}
        onClick={() => (link ? router.push(link) : router.back())}
        className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        {isChatRoute ? (
          <PlusCircle className="size-6" />
        ) : (
          <ArrowLeft className="size-6" />
        )}
      </button>
      {title ? (
        <div className="min-w-0">
          <motion.p
            key={title}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="truncate text-xl font-bold text-foreground"
          >
            {title}
          </motion.p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
