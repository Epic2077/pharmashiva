import { notFound } from "next/navigation";
import { LayoutGrid, Pill } from "lucide-react";
import BackLink from "@/components/shared/BackLink";
import CategoriesCard from "@/components/search/CategoriesCard";
import ProductCardList from "@/components/products/ProductCardList";
import {
  getCategoryAncestors,
  getCategoryById,
  getChildCategoriesWithProductCounts,
  getProductsByCategory,
} from "@/lib/supabase";
import { getServerLanguage, localizeCategoryName } from "@/lib/i18n-server";
import type {
  Category,
  CategoryWithCount,
  ProductDetails,
} from "@/types/database";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("Supabase query failed:", error);
    return fallback;
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;
  const language = await getServerLanguage();

  const category = await safe(getCategoryById(id), null);
  if (!category) notFound();

  const [ancestors, subcategories, products] = await Promise.all([
    safe(getCategoryAncestors(id), [] as Category[]),
    safe(getChildCategoriesWithProductCounts(id), [] as CategoryWithCount[]),
    safe(getProductsByCategory(id, { limit: 60 }), [] as ProductDetails[]),
  ]);

  // Category names are Persian-only in the DB, so localize (translate) them.
  const title = await localizeCategoryName(category, language);

  const breadcrumb = (
    await Promise.all(
      ancestors.map((ancestor) => localizeCategoryName(ancestor, language)),
    )
  ).join(" › ");

  const subcategoryItems = await Promise.all(
    subcategories.map(async (subcategory) => ({
      ...subcategory,
      title: await localizeCategoryName(subcategory, language),
    })),
  );

  const productItems = await Promise.all(
    products.map(async (product) => ({
      product,
      categoryName: product.categories[0]
        ? await localizeCategoryName(product.categories[0], language)
        : null,
    })),
  );

  return (
    <div className="flex flex-col gap-6 pt-2">
      <BackLink title={title} subtitle={breadcrumb} link="/search" />

      {subcategories.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <LayoutGrid className="size-4 text-primary" />
            <h3 className="text-base font-semibold">Subcategories</h3>
          </div>
          {subcategoryItems.map((subcategory) => (
            <CategoriesCard
              key={subcategory.id}
              icon={<Pill className="size-5" />}
              title={subcategory.title}
              count={subcategory.productCount}
              href={`/categories/${subcategory.id}`}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="px-1 text-base font-semibold">
          Products
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            ({products.length})
          </span>
        </h3>

        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            No products found.
          </p>
        ) : (
          <ProductCardList items={productItems} language={language} />
        )}
      </section>
    </div>
  );
}
