export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="bg-[url('/background.png')] flex items-center justify-center w-screen h-screen">
      <div className="w-[90%]">{children}</div>
    </div>
  );
}
