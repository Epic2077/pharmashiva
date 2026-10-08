import HomeHeader from "@/components/home/Header";
import HomeNavigation from "@/components/home/Navigation";
import NavMenu from "@/components/shared/nav-menu/NavMenu";

export default function HomePage() {
  const time =
    new Date().getDate() < 12
      ? "Good Morning"
      : new Date().getDate() < 18
        ? "Good Afternoon"
        : "Good Evening";

  const name = "Shiva"; //Mock data
  return (
    <div className="min-w-screen min-h-screen py-1 px-5" dir="ltr">
      <HomeHeader isLoggedIn={false} user={() => {}} />
      <h2 className="text-4xl font-bold mt-6">
        {time},<span className="block">{name}👋</span>
        <span className="block text-muted-foreground mt-2 text-sm">
          How can I help you today?
        </span>
      </h2>
      <HomeNavigation />
      <NavMenu />
    </div>
  );
}
