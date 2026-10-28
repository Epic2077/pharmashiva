import type { ReactNode } from "react";
import AppShell from "@/components/shared/AppShell";

export default function CategoriesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell wide>{children}</AppShell>;
}
