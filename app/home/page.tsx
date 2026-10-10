import HomeHeader from "@/components/home/Header";
import HomeNavigation from "@/components/home/Navigation";
import { greeting } from "@/lib/greeting";

export default function HomePage() {
  const name = "Shiva"; //Mock data
  return (
    <div>
      <HomeHeader isLoggedIn={false} user={() => {}} />
      <h2 className="text-4xl font-bold mt-6">
        {greeting()},<span className="block">{name}👋</span>
        <span className="block text-muted-foreground mt-2 text-sm">
          How can I help you today?
        </span>
      </h2>
      <HomeNavigation />
    </div>
  );
}
