import { LayoutGrid, Pill } from "lucide-react";
import CategoriesCard from "@/components/search/CategoriesCard";
import CategorySearch from "@/components/categories/CategorySearch";
import Title from "@/components/shared/Title";
import { getTopLevelCategoriesWithProductCounts } from "@/lib/supabase";
import { getServerLanguage, localizeCategoryName } from "@/lib/i18n-server";
import type { CategoryWithCount } from "@/types/database";

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("Supabase query failed:", error);
    return fallback;
  }
}

export default async function CategoriesPage() {
  const language = await getServerLanguage();

  const topLevel = await safe(
    getTopLevelCategoriesWithProductCounts(),
    [] as CategoryWithCount[],
  );

  const items = await Promise.all(
    topLevel.map(async (category) => ({
      id: category.id,
      title: await localizeCategoryName(category, language),
      count: category.productCount,
    })),
  );

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Title
        title="Categories"
        subtitle="Browse or search all categories"
        profile
      />

      <CategorySearch />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid className="size-4 text-primary" />
          <h3 className="text-base font-semibold">Top categories</h3>
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            No categories found.
          </p>
        ) : (
          items.map((item) => (
            <CategoriesCard
              key={item.id}
              icon={<Pill className="size-5" />}
              title={item.title}
              count={item.count}
              href={`/categories/${item.id}`}
            />
          ))
        )}
      </section>
    </div>
  );
}
