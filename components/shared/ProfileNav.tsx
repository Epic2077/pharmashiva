"use client";

import { useRouter } from "next/navigation";
import {
  CreditCardIcon,
  LogIn,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { ImEnter } from "react-icons/im";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { logoutAction } from "@/lib/auth/actions";

export interface ProfileNavUser {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface ProfileNavProps {
  isLoggedIn: boolean;
  /** Current user, when signed in. Drives the avatar and the menu header. */
  user?: ProfileNavUser | null;
}

function initialsOf(user: ProfileNavUser | null | undefined): string {
  const source = user?.fullName?.trim() || user?.email?.trim() || "";
  if (!source) return "";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase();
}

export default function ProfileNav({
  isLoggedIn = false,
  user,
}: ProfileNavProps) {
  const router = useRouter();
  const initials = initialsOf(user);
  const displayName = user?.fullName?.trim() || user?.email || "Account";

  return (
    <DropdownMenu>
      {/* Trigger renders a native <button>, so style it directly instead of
          swapping in a div via `render` (Base UI drops button semantics). */}
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted mt-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
          <AvatarFallback>{initials || <UserIcon className="size-4" />}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      {isLoggedIn ? (
        <DropdownMenuContent className="w-56 flex flex-col gap-2">
          <div className="flex flex-col px-1.5 py-1">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {user?.fullName && user?.email ? (
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex items-center gap-2 text-base">
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 text-base">
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 text-base"
            onClick={() => router.push("/setting")}
          >
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Server action so the session cookies are cleared server-side. */}
          <form action={logoutAction}>
            <DropdownMenuItem
              render={<button type="submit" className="w-full" />}
              variant="destructive"
              className="flex items-center gap-2 text-base"
            >
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </form>
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
