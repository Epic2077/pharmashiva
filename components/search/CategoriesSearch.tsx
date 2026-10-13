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
import type { CategoryWithCount } from "@/types/database";

interface CategoriesSearchProps {
  categories: CategoryWithCount[];
}

function iconFor(name: string): ReactElement {
  const text = name.toLowerCase();
  if (/(vitamin|ویتامین)/.test(text)) return <Pill className="size-5" />;
  if (/(herbal|گیاهی)/.test(text)) return <Leaf className="size-5" />;
  if (/(mineral|معدنی)/.test(text)) return <Gem className="size-5" />;
  if (/(digest|گوارش)/.test(text)) return <Soup className="size-5" />;
  if (/(immune|ایمنی)/.test(text)) return <Shield className="size-5" />;
  if (/(pain|درد)/.test(text)) return <Bandage className="size-5" />;
  return <Pill className="size-5" />;
}

export default function CategoriesSearch({ categories }: CategoriesSearchProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <LayoutGrid className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Categories</h3>
      </div>
      {categories.map((category) => (
        <CategoriesCard
          key={category.id}
          icon={iconFor(category.name)}
          title={category.name}
          count={category.productCount}
          href={`/search?category=${category.id}`}
        />
      ))}
    </div>
  );
}
