import AppShell from "@/components/shared/AppShell";
import SettingHeader from "@/components/setting/SettingHeader";

export default function SettingLayout({ children }: LayoutProps<"/setting">) {
  return (
    <AppShell>
      <header>
        <SettingHeader />
      </header>
      <main>
        <section className="flex flex-col gap-4 pt-5">{children}</section>
      </main>
    </AppShell>
  );
}
