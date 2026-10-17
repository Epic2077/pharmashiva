import Link from "next/link";
import BackLink from "@/components/shared/BackLink";
import ProductCardList from "@/components/products/ProductCardList";
import { searchProducts } from "@/lib/darukade/service";
import {
  getCategoryTree,
  findCategoryNodeById,
  requestForCategoryNode,
  type DarukadeCategoryNode,
} from "@/lib/darukade/categories";
import { getServerLanguage } from "@/lib/i18n-server";
import type { ProductSearchHit } from "@/types/database";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { id } = await params;
  const { q } = await searchParams;
  const language = await getServerLanguage();

  let tree: DarukadeCategoryNode[] = [];
  try {
    tree = await getCategoryTree();
  } catch (error) {
    console.error("Category tree unavailable:", error);
  }

  const node = findCategoryNodeById(tree, id);
  const request = node ? requestForCategoryNode(node) : undefined;

  if (!node || !request || request.kind === "unsupported") {
    return (
      <div className="flex flex-col gap-6 pt-2">
        <BackLink title="Category" subtitle="" link="/search" />
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          This category is not in Darukade&apos;s current navigation, or cannot
          be browsed through the product API.
        </p>
        <Link
          href="/categories"
          className="inline-flex w-fit rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          All categories
        </Link>
      </div>
    );
  }

  const query = q?.trim() ?? "";
  const heading = query ? `“${query}” in ${node.title}` : node.title;

  let products: ProductSearchHit[] = [];
  let error: string | null = null;
  try {
    const outcome = await searchProducts(query, {
      limit: 20,
      detailLimit: 8,
      budgetMs: 6_000,
      category: request,
    });
    products = outcome.hits;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unknown error";
  }

  const items = products.map((hit) => ({
    product: hit.product,
    categoryName: null,
  }));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <BackLink title={node.title} subtitle="Category" link="/search" />

      <section className="flex flex-col gap-3">
        <h3 className="px-1 text-base font-semibold">
          {heading}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            ({products.length})
          </span>
        </h3>

        {error ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6 text-sm text-destructive">
            Could not load this category from Darukade: {error}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            No products found in this category.
          </p>
        ) : (
          <ProductCardList items={items} language={language} />
        )}
      </section>
    </div>
  );
}
