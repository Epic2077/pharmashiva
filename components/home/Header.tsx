import { User } from "lucide-react";
import Logo from "../shared/Logo";
import { FaUserAlt } from "react-icons/fa";
import ProfileNav from "../shared/ProfileNav";

interface HomeHeaderProps {
  isLoggedIn: boolean;
  user: () => void;
}

export default function HomeHeader({
  isLoggedIn = false,
  user,
}: HomeHeaderProps) {
  return (
    <header className="flex flex-row justify-between items-center w-full  py-4 bg-transparent">
      <Logo
        size="medium"
        className="flex flex-row! gap-4 items-center justify-center"
        title
      />
      <ProfileNav isLoggedIn={isLoggedIn} />
    </header>
  );
}
