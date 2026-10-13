import SettingHeader from "@/components/setting/SettingHeader";
import NavMenu from "@/components/shared/nav-menu/NavMenu";

export default function SettingLayout({ children }: LayoutProps<"/setting">) {
  return (
    <div className="flex h-dvh min-w-screen flex-col">
      <div className="px-5">
        <NavMenu variant="desktop" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-1 mt-3">
          <header>
            <SettingHeader />
          </header>
          <main>
            <section className="flex flex-col gap-4 pt-5">{children}</section>
          </main>
        </div>
      </div>
      <NavMenu />
    </div>
  );
}
