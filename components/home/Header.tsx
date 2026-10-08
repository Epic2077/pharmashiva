import { User } from "lucide-react";
import Logo from "../shared/Logo";
import { FaUserAlt } from "react-icons/fa";

interface HomeHeaderProps {
  isLoggedIn: boolean;
  user: () => void;
}

export default function HomeHeader({ isLoggedIn, user }: HomeHeaderProps) {
  return (
    <header className="flex flex-row justify-between items-center w-full  py-4 bg-transparent">
      <Logo
        size="medium"
        className="flex flex-row! gap-4 items-center-safe"
        title
      />
      {isLoggedIn ? (
        <></>
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mt-1.5">
          <FaUserAlt className="w-6 h-6 text-primary m-auto" />
        </div>
      )}
    </header>
  );
}
