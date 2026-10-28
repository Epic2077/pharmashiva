import { BookOpen, History, MessageCircle, Package, Settings } from "lucide-react";
import NavigationButton from "./NavigationButton";

export default function HomeNavigation() {
  const nav = [
    {
      id: "new-consultation",
      name: "New Consultation",
      sub: "Start a new patient case",
      href: "/home/chat",
      icon: <MessageCircle className="size-6" />,
    },
    {
      id: "recent-cases",
      name: "Recent Cases",
      sub: "View your past consultations",
      href: "/home/history",
      icon: <History className="size-6" />,
    },
    {
      id: "medical-reference",
      name: "Medical Reference",
      sub: "Evidence-backed medical information",
      href: "/reference",
      icon: <BookOpen className="size-6" />,
    },
    {
      id: "product-search",
      name: "Product Search",
      sub: "Search supplements directly",
      href: "/search",
      icon: <Package className="size-6" />,
    },
    {
      id: "settings",
      name: "Settings",
      sub: "App & account preferences",
      href: "/setting",
      icon: <Settings className="size-6" />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {nav.map((item) => (
        <NavigationButton key={item.id} item={item} />
      ))}
    </div>
  );
}
