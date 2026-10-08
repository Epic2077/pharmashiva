"use client";

import {
  Search,
  MoreHorizontal,
  Settings,
  User,
  Bell,
  History,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaHome } from "react-icons/fa";

export default function NavMenu() {
  const [active, setActive] = useState("Home");
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const iconClass = `w-6 h-6 ${active === "Home" ? "text-primary" : "text-foreground"}`;
  const navMenuItems = [
    { title: "Home", href: "/home", icon: <FaHome className={iconClass} /> },
    {
      title: "history",
      href: "/history",
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

    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMore(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const moreItems = [
    { title: "Profile", href: "/profile", icon: <User className="w-5 h-5" /> },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="w-5 h-5" />,
    },
    {
      title: "Notifications",
      href: "/notifications",
      icon: <Bell className="w-5 h-5" />,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-background border-t border-border py-4">
      <div className="flex justify-around items-center">
        {navMenuItems.map((item) => (
          <Link
            aria-label={item.title}
            href={item.href}
            key={item.title}
            className="flex flex-col items-center justify-center text-sm text-foreground hover:text-primary transition-colors duration-200 gap-1"
            onClick={() => setShowMore(false)}
          >
            {item.icon}
            <span
              className={`${active === item.title ? "text-primary" : "text-muted-foreground"}`}
            >
              {item.title}
            </span>
          </Link>
        ))}

        <div ref={moreRef} className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            aria-label="More"
            className="flex flex-col items-center justify-center text-sm text-foreground hover:text-primary transition-colors duration-200 gap-1"
          >
            <MoreHorizontal className={iconClass} />
            <span className="text-muted-foreground">More</span>
          </button>

          {showMore && (
            <div className="absolute bottom-full left-0 -translate-x-1/2 mb-2 bg-background border border-border rounded-lg shadow-lg min-w-[150px] overflow-hidden z-50">
              {moreItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent hover:text-primary transition-colors duration-150"
                  onClick={() => setShowMore(false)}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
