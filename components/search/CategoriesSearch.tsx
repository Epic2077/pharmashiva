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
import Link from "next/link";

interface CategoryItem {
  id: string;
  title: string;
  count: number;
}

interface CategoriesSearchProps {
  categories: CategoryItem[];
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

export default function CategoriesSearch({
  categories,
}: CategoriesSearchProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <LayoutGrid className="size-4 text-primary" />
        <div className="flex items-center justify-between w-full">
          <h3 className="text-base font-semibold">Categories</h3>
          <Link
            href="/categories"
            className="text-sm font-medium text-primary text-end transition-colors hover:text-primary/80"
          >
            View All
          </Link>
        </div>
      </div>
      {categories.map((category) => (
        <CategoriesCard
          key={category.id}
          icon={iconFor(category.title)}
          title={category.title}
          count={category.count}
          href={`/categories/${category.id}`}
        />
      ))}
    </div>
  );
}
