import { User } from "lucide-react";
import Logo from "../shared/Logo";

interface HomeHeaderProps {
  isLoggedIn: boolean;
  user: () => void;
}

export default function HomeHeader({ isLoggedIn, user }: HomeHeaderProps) {
  return (
    <header className="flex flex-row justify-between items-center w-full px-4 py-4 bg-transparent">
      <Logo
        size="medium"
        className="flex flex-row! gap-4 items-center-safe"
        title
      />
      {isLoggedIn ? (
        <></>
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mt-1.5">
          <User className="w-8 h-8 text-primary m-auto" />
        </div>
      )}
    </header>
  );
}
