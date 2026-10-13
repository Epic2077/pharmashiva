import {
  HistoryIcon,
  LanguagesIcon,
  LogOutIcon,
  PaletteIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import SettingProfile from "@/components/setting/SettingProfile";
import SettingTabs from "@/components/setting/SettingTabs";
import Logo from "@/components/shared/Logo";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

export default function SettingPage() {
  return (
    <div className="flex flex-col gap-6">
      <SettingProfile />

      {/* Tabs with `dialogue` open a modal instead of navigating. */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Preferences</SectionLabel>
        <SettingTabs
          icon={<PaletteIcon className="size-5" />}
          title="Appearance"
          description="Theme, colors and contrast"
          dialogue
        />
        <SettingTabs
          icon={<LanguagesIcon className="size-5" />}
          title="Language"
          description="App interface language"
          dialogue
        />
      </div>

      {/* Tabs with `href` navigate; no dialogue is rendered for them. */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Account</SectionLabel>
        <SettingTabs
          icon={<HistoryIcon className="size-5" />}
          title="Chat History"
          description="Review past conversations"
          href="/home/history"
        />
        <SettingTabs
          icon={<LogOutIcon className="size-5" />}
          title="Log out"
          description="Sign out of your account"
          href="/auth/login"
          variant="destructive"
        />

        <Logo size="small" className="mt-6 flex-col" title />
        <p className=" mb-5 text-muted-foreground text-sm text-center">
          Version 1.0.0
        </p>
      </div>
    </div>
  );
}
