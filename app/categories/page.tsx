import { LayoutGrid, Pill } from "lucide-react";
import CategoriesCard from "@/components/search/CategoriesCard";
import CategorySearch from "@/components/categories/CategorySearch";
import Title from "@/components/shared/Title";
import { getCategoryTree } from "@/lib/darukade/categories";
import { getServerLanguage } from "@/lib/i18n-server";

export default async function CategoriesPage() {
  const language = await getServerLanguage();
  void language;

  let items: Array<{ id: string; title: string; count: number }> = [];
  let unavailable = false;
  try {
    const tree = await getCategoryTree();
    items = tree.map((node) => ({
      id: node.id !== null ? String(node.id) : node.url,
      title: node.title,
      count: node.children.length,
    }));
  } catch (error) {
    console.error("Category tree unavailable:", error);
    unavailable = true;
  }

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
            {unavailable
              ? "Category navigation could not be loaded from Darukade right now."
              : "No categories are available from Darukade right now."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <CategoriesCard
                key={item.id}
                icon={<Pill className="size-5" />}
                title={item.title}
                count={item.count}
                href={`/categories/${item.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
