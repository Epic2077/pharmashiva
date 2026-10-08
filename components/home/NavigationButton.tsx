"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

interface NavigationButtonProps {
  id: string;
  name: string;
  sub: string;
  href: string;
  icon: React.ReactNode;
}

export default function NavigationButton({
  item,
}: {
  item: NavigationButtonProps;
}) {
  return (
    <Button
      className={`flex items-center justify-between shadow-xl w-full h-24 px-4 py-2 rounded-lg ${item.id === "new-consultation" ? "bg-[url('/texture/texture-green.png')] hover:bg-[url('/texture/texture-green.png')]/80 bg-center" : "bg-card hover:bg-card/80"} transition-colors duration-200`}
      key={item.id}
      onClick={() => (window.location.href = item.href)}
    >
      <div className="flex items-center gap-6 w-10 h-10">
        {item.icon}
        <div className="flex flex-col  items-start">
          <h3
            className={`font-medium text-2xl ${item.id === "new-consultation" ? "text-background" : "text-foreground"}`}
          >
            {item.name}
          </h3>
          <p
            className={`text-sm ${item.id === "new-consultation" ? "text-muted" : "text-muted-foreground"}`}
          >
            {item.sub}
          </p>
        </div>
      </div>
      <ChevronRight
        className={`w-6 h-6 size-0 ${item.id === "new-consultation" ? "text-background" : "text-muted-foreground"}`}
      />
    </Button>
  );
}
