import type { ReactNode } from "react";
import NavMenu from "@/components/shared/nav-menu/NavMenu";

export default function CategoriesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh min-w-screen flex-col px-5 py-1">
      <NavMenu variant="desktop" />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <NavMenu />
    </div>
  );
}
