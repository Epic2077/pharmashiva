"use client";

import {
  Search,
  MoreHorizontal,
  Settings,
  User,
  Bell,
  History,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaHome } from "react-icons/fa";

export default function NavMenu() {
  const [active, setActive] = useState("Home");

  const iconClass = `w-6 h-6 ${active === "Home" ? "text-primary" : "text-foreground"}`;
  const navMenuItems = [
    { title: "Home", href: "/home", icon: <FaHome className={iconClass} /> },
    {
      title: "Chat",
      href: "/home/chat",
      icon: <MessageCircle className={iconClass} />,
    },
    {
      title: "history",
      href: "/home/history",
      icon: <History className={iconClass} />,
    },
    {
      title: "Search",
      href: "/search",
      icon: <Search className={iconClass} />,
    },
  ];

  useEffect(() => {
    window.addEventListener("popstate", () => {
      const currentPath = window.location.pathname;
      const activeItem = navMenuItems.find((item) => item.href === currentPath);
      if (activeItem) {
        setActive(activeItem.title);
      }
    });
  }, []);

  return (
    // In normal flow inside the home layout's column, so it reserves its own
    // space instead of covering whatever is underneath it.
    <div className="w-full shrink-0 bg-background border-t border-border py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-around items-center">
        {navMenuItems.map((item) => (
          <Link
            aria-label={item.title}
            href={item.href}
            key={item.title}
            className="flex flex-col items-center justify-center text-sm text-foreground hover:text-primary transition-colors duration-200 gap-1"
          >
            {item.icon}
            <span
              className={`${active === item.title ? "text-primary" : "text-muted-foreground"}`}
            >
              {item.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
