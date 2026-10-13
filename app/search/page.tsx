import CategoriesSearch from "@/components/search/CategoriesSearch";
import PopularSearch from "@/components/search/PopularSearch";
import SearchBar from "@/components/search/SearchBar";
import SearchResults from "@/components/search/SearchResults";
import Title from "@/components/shared/Title";
import {
  getCategoryById,
  getPopularSearchTerms,
  getProductsByCategory,
  getTopLevelCategoriesWithProductCounts,
  searchCatalog,
} from "@/lib/supabase";
import type { CategoryWithCount, Product } from "@/types/database";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("Supabase query failed:", error);
    return fallback;
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, category } = await searchParams;
  const query = q?.trim();
  const categoryId = category?.trim();

  // ── Results view (search query or selected category) ────────
  if (query || categoryId) {
    let heading = "";
    let products: Product[] = [];

    if (categoryId) {
      const [category, categoryProducts] = await Promise.all([
        safe(getCategoryById(categoryId), null),
        safe(getProductsByCategory(categoryId, { limit: 50 }), []),
      ]);
      heading = category?.name ?? "Category";
      products = categoryProducts;
    } else if (query) {
      const hits = await safe(searchCatalog(query, 20), []);
      heading = `Results for “${query}”`;
      products = hits.map((hit) => hit.product);
    }

    return (
      <div className="flex flex-col gap-8 pt-2">
        <Title title="Search Results" subtitle={heading} profile />
        <SearchBar
          key={categoryId ?? query ?? ""}
          defaultValue={query ?? ""}
          resultCount={products.length}
        />
        <SearchResults heading={heading} products={products} />
      </div>
    );
  }

  // ── Default view: browse categories and popular terms ───────
  const [categories, popularTerms] = await Promise.all([
    safe(getTopLevelCategoriesWithProductCounts(), [] as CategoryWithCount[]),
    safe(getPopularSearchTerms(8), [] as string[]),
  ]);

  return (
    <div className="flex flex-col gap-8 pt-2">
      <Title
        title="Search Products"
        subtitle="Find medicines & supplements"
        profile
      />
      <SearchBar defaultValue="" />
      <PopularSearch searches={popularTerms} />
      <CategoriesSearch categories={categories} />
    </div>
  );
}
