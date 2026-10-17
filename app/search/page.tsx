import { Suspense } from "react";
import CategoriesSearch from "@/components/search/CategoriesSearch";
import PopularSearch from "@/components/search/PopularSearch";
import SearchBar from "@/components/search/SearchBar";
import Title from "@/components/shared/Title";
import {
  getPopularSearchTerms,
  getTopLevelCategoriesWithProductCounts,
  searchCatalogAi,
} from "@/lib/supabase";
import { getServerLanguage, localizeCategoryName } from "@/lib/i18n-server";
import type { CategoryWithCount } from "@/types/database";
import SearchResults from "@/components/search/SearchResults";
import RecentSearches from "@/components/search/RecentSearches";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
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
  const { q } = await searchParams;
  const query = q?.trim();
  const language = await getServerLanguage();

  // ── Results view (search query) ──────────────────────────────
  if (query) {
    // Matches product name / name_en / brand / SKU / barcode as well as active
    // ingredients and categories, so "zinc" or "moisturizer" find real products.
    const hits = await safe(searchCatalogAi(query, 20), []);
    const products = hits.map((hit) => hit.product);
    const heading = `Results for “${query}”`;

    return (
      <div className="flex flex-col gap-8 pt-2">
        <Title title="Search Results" subtitle={heading} profile />
        <Suspense
          fallback={
            <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
          }
        >
          <SearchBar resultCount={products.length} />
        </Suspense>
        <SearchResults
          heading={heading}
          products={products}
          language={language}
        />
      </div>
    );
  }

  // ── Default view: browse categories and popular terms ───────
  const [categories, popularTerms] = await Promise.all([
    safe(getTopLevelCategoriesWithProductCounts(), [] as CategoryWithCount[]),
    safe(getPopularSearchTerms(8), [] as string[]),
  ]);

  const categoryItems = await Promise.all(
    categories.map(async (category) => ({
      id: category.id,
      title: await localizeCategoryName(category, language),
      count: category.productCount,
    })),
  );

  return (
    <div className="flex flex-col gap-8 pt-2">
      <Title
        title="Search Products"
        subtitle="Find medicines & supplements"
        profile
      />
      <Suspense
        fallback={
          <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
        }
      >
        <SearchBar />
      </Suspense>
      <RecentSearches />
      <PopularSearch searches={popularTerms} />
      <CategoriesSearch categories={categoryItems} />
    </div>
  );
}
