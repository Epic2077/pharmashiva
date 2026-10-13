"use client";

import BackLink from "@/components/shared/BackLink";
import { usePathname } from "next/navigation";

/**
 * Header for every route under /setting (e.g. /setting, /setting/profile).
 * It needs to be a Client Component because it derives its title from the
 * current pathname, which is only available through the usePathname hook.
 */
export default function SettingHeader() {
  const pathname = usePathname();
  const segment = pathname?.substring(pathname.lastIndexOf("/") + 1) ?? "";
  // Last path segment, e.g. "setting" or "profile" — capitalised for display.
  const title = segment.charAt(0).toUpperCase() + segment.slice(1);

  return (
    <div className="flex items-center justify-between">
      <BackLink title={title} subtitle={title === "Setting" ? "" : "Settings"} />
    </div>
  );
}
