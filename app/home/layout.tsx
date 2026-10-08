import NavMenu from "@/components/shared/nav-menu/NavMenu";

export default function HomeLayout({ children }: LayoutProps<"/home">) {
  return (
    <div>
      {children}
      <NavMenu />
    </div>
  );
}
