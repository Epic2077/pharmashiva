import HomeHeader from "@/components/home/Header";
import HomeNavigation from "@/components/home/Navigation";
import { greeting } from "@/lib/greeting";

export default function HomePage() {
  const name = "Shiva"; //Mock data
  return (
    <div className="flex flex-col gap-6">
      <HomeHeader isLoggedIn={false} user={() => {}} />
      <section className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-bold leading-tight">
          {greeting()}, {name}
        </h2>
        <p className="text-sm text-muted-foreground">
          How can I help you today?
        </p>
      </section>
      <HomeNavigation />
    </div>
  );
}
