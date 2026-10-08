import { History, MessageCircle, Package, Settings } from "lucide-react";
import NavigationButton from "./NavigationButton";

export default function HomeNavigation() {
  const nav = [
    {
      id: "new-consultation",
      name: "New Consultation",
      sub: "Start a new patient case",
      href: "/chat",
      icon: <MessageCircle className="w-6 h-6 text-background size-0" />,
    },
    {
      id: "recent-cases",
      name: "recent cases",
      sub: "View your past consultations",
      href: "/history",
      icon: <History className="w-6 size-0 h-6 size-0 text-foreground" />,
    },
    {
      id: "product-search",
      name: "Product Search",
      sub: "Search supplimentts directly",
      href: "/products",
      icon: <Package className="w-6 size-0 h-6 size-0 text-foreground" />,
    },
    {
      id: "settings",
      name: "Settings",
      sub: "App & account preferences",
      href: "/settings",
      icon: <Settings className="w-6 size-0 h-6 size-0 text-foreground" />,
    },
  ];

  return (
    <div className="grid gap-4 mt-10">
      {nav.map((item) => (
        <NavigationButton key={item.id} item={item} />
      ))}
    </div>
  );
}
