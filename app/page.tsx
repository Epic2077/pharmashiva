import Logo from "@/components/shared/Logo";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full items-center justify-between bg-[url('/background.png')] bg-cover bg-no-repeat dark:bg-black sm:items-start">
        <div className=" h-screen w-screen bg-muted-foreground/20 flex flex-col justify-between items-center">
          <div
            className="flex flex-col  items-center mt-52 animate-in fade-in duration-300"
            id="logo"
            aria-label="Logo"
          >
            <Logo size="large" subtitle title />
          </div>
          <div className="flex flex-col items-center mb-10 animate-in fade-in duration-300">
            <p className="mb-1">سوالات بهتر.</p>
            <p className="mb-12 text-foreground">توصیه های مطمئن.</p>
            <p className="text-muted-foreground" dir="ltr">
              © 2026 PharmaShiva. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
