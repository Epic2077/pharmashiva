import type { ReactElement } from "react";
import {
  Bandage,
  Gem,
  LayoutGrid,
  Leaf,
  Pill,
  Shield,
  Soup,
} from "lucide-react";
import CategoriesCard from "./CategoriesCard";

interface Category {
  icon: ReactElement;
  title: string;
  count: number;
}

export default function CategoriesSearch() {
  const categories: Category[] = [
    { icon: <Pill className="size-5" />, title: "Vitamins", count: 142 },
    { icon: <Bandage className="size-5" />, title: "Pain Relief", count: 89 },
    { icon: <Gem className="size-5" />, title: "Minerals", count: 56 },
    {
      icon: <Leaf className="size-5" />,
      title: "Herbal Supplements",
      count: 73,
    },
    { icon: <Soup className="size-5" />, title: "Digestive Health", count: 42 },
    { icon: <Shield className="size-5" />, title: "Immune Support", count: 67 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <LayoutGrid className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Categories</h3>
      </div>
      {categories.map((category) => (
        <CategoriesCard
          key={category.title}
          icon={category.icon}
          title={category.title}
          count={category.count}
          href={`/categories/${category.title.toLowerCase().replace(/ /g, "-")}`}
        />
      ))}
    </div>
  );
}
