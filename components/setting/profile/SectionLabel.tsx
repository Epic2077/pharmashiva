import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
