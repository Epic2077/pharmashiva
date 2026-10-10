"use client";

import { useRouter } from "next/navigation";
import {
  CreditCardIcon,
  LogIn,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { FaUserAlt } from "react-icons/fa";
import { ImEnter } from "react-icons/im";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ProfileNavProps {
  isLoggedIn: boolean;
}

export default function ProfileNav({ isLoggedIn = false }: ProfileNavProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      {/* Trigger renders a native <button>, so style it directly instead of
          swapping in a div via `render` (Base UI drops button semantics). */}
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted mt-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FaUserAlt className="size-6 text-primary" />
      </DropdownMenuTrigger>
      {isLoggedIn ? (
        <DropdownMenuContent className="w-56 flex flex-col gap-2">
          <DropdownMenuItem className="flex items-center gap-2 text-base">
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 text-base">
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 text-base">
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="flex items-center gap-2 text-base"
          >
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      ) : (
        <DropdownMenuContent className="w-56 flex flex-col gap-2">
          <DropdownMenuItem
            className="flex items-center gap-2 text-base"
            onClick={() => router.push("/auth/login")}
          >
            <LogIn />
            Log in
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 text-base"
            onClick={() => router.push("/auth/signup")}
          >
            <ImEnter />
            Sign up
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
