import Logo from "../shared/Logo";
import ProfileNav, { type ProfileNavUser } from "../shared/ProfileNav";

interface HomeHeaderProps {
  isLoggedIn: boolean;
  user?: ProfileNavUser | null;
}

export default function HomeHeader({
  isLoggedIn = false,
  user,
}: HomeHeaderProps) {
  return (
    <header className="flex flex-row justify-between items-center w-full pt-4 bg-transparent">
      {/* The brand lives in the desktop sidebar, so hide the in-page logo there. */}
      <Logo
        size="medium"
        className="flex flex-row! gap-4 items-center justify-center lg:hidden"
        title
      />
      <ProfileNav isLoggedIn={isLoggedIn} user={user} />
    </header>
  );
}
