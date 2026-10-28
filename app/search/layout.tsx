import AppShell from "@/components/shared/AppShell";

export default function SearchLayout({ children }: LayoutProps<"/search">) {
  return <AppShell wide>{children}</AppShell>;
}
