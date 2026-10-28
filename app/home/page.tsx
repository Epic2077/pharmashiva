import AppShell from "@/components/shared/AppShell";
import HomeHeader from "@/components/home/Header";
import HomeNavigation from "@/components/home/Navigation";
import { getSessionUser } from "@/lib/auth/session";
import { greeting } from "@/lib/greeting";

export default async function HomePage() {
  const user = await getSessionUser();
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const name = firstName || user?.email?.split("@")[0] || "there";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <HomeHeader isLoggedIn={Boolean(user)} user={user} />
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
    </AppShell>
  );
}
