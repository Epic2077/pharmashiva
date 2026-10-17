import { Suspense } from "react";
import PopularSearch from "@/components/search/PopularSearch";
import SearchBar from "@/components/search/SearchBar";
import Title from "@/components/shared/Title";
import { searchProducts, type SearchOutcome } from "@/lib/darukade/service";
import {
  getCategoryTree,
  findCategoryNodeById,
  requestForCategoryNode,
  isSelectableSubcategory,
  type DarukadeCategoryNode,
} from "@/lib/darukade/categories";
import { getServerLanguage, localizeTitlesBounded } from "@/lib/i18n-server";
import SearchResults from "@/components/search/SearchResults";
import RecentSearches from "@/components/search/RecentSearches";
import CategorySelect, {
  type CategoryChip,
} from "@/components/search/CategorySelect";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("Darukade search failed:", error);
    return fallback;
  }
}

function chipFor(node: DarukadeCategoryNode, label: string): CategoryChip {
  return {
    id: String(node.id),
    title: node.title,
    label,
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, cat } = await searchParams;
  const query = q?.trim();
  const language = await getServerLanguage();

  // Verified category tree (in-process cached; empty on failure).
  const tree = await safe(getCategoryTree(), [] as DarukadeCategoryNode[]);

  // ── Category chips: top-level categories with display labels ──
  const parentNodes = tree.filter(
    (top) => requestForCategoryNode(top).kind !== "unsupported",
  );
  const parentLabels = await localizeTitlesBounded(
    parentNodes.map((node) => node.title),
    language,
  );
  const parents = parentNodes.map((node, index) =>
    chipFor(node, parentLabels[index] ?? node.title),
  );

  const selectedNode = cat ? findCategoryNodeById(tree, cat) : null;
  const selectedParent =
    selectedNode && selectedNode.parentId !== null
      ? findCategoryNodeById(tree, selectedNode.parentId)
      : selectedNode;
  const selectedParentId = selectedParent ? String(selectedParent.id) : null;

  const initialChildNodes = selectedParent
    ? selectedParent.children.filter(isSelectableSubcategory)
    : [];
  const initialChildLabels = await localizeTitlesBounded(
    initialChildNodes.map((node) => node.title),
    language,
  );
  const initialChildren = initialChildNodes.map((node, index) =>
    chipFor(node, initialChildLabels[index] ?? node.title),
  );

  const [selectedLabel] = selectedNode
    ? await localizeTitlesBounded([selectedNode.title], language)
    : [null];

  const selector = (
    <Suspense
      fallback={
        <div className="h-9 w-full animate-pulse rounded-2xl bg-muted" />
      }
    >
      <CategorySelect
        key={selectedParentId ?? "none"}
        parents={parents}
        selectedId={selectedNode ? String(selectedNode.id) : null}
        selectedLabel={selectedLabel ?? null}
        selectedParentId={selectedParentId}
        initialChildren={initialChildren}
        language={language}
      />
    </Suspense>
  );

  // Results screens show only the active filter chip — never the explorer.
  const activeFilterChip = (
    <Suspense fallback={null}>
      <CategorySelect
        parents={parents}
        selectedId={selectedNode ? String(selectedNode.id) : null}
        selectedLabel={selectedLabel ?? null}
        selectedParentId={selectedParentId}
        initialChildren={initialChildren}
        language={language}
        activeOnly
      />
    </Suspense>
  );

  // ── Results view (query and/or category) ────────────────────
  if (query || selectedNode) {
    const categoryRequest = selectedNode
      ? requestForCategoryNode(selectedNode)
      : undefined;
    const categoryUsable =
      categoryRequest !== undefined && categoryRequest.kind !== "unsupported";

    const outcome = await safe(
      searchProducts(query ?? "", {
        limit: 20,
        detailLimit: 8,
        budgetMs: 6_000,
        category: categoryUsable ? categoryRequest : undefined,
      }),
      null as SearchOutcome | null,
    );

    const heading = query
      ? `Results for “${query}”`
      : selectedNode
        ? `Products in “${selectedLabel ?? selectedNode.title}”`
        : "Search Results";

    if (!outcome) {
      return (
        <div className="flex flex-col gap-8 pt-2">
          <Title title="Search Results" subtitle={heading} profile />
          <Suspense
            fallback={
              <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
            }
          >
            <SearchBar />
          </Suspense>
          {activeFilterChip}
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6 text-sm text-destructive">
            Product search is temporarily unavailable. Darukade could not be
            reached — please try again in a moment.
          </p>
        </div>
      );
    }

    const products = outcome.hits.map((hit) => hit.product);
    const note =
      selectedNode && !categoryUsable
        ? "This category cannot be constrained at the source while searching, so results are unfiltered."
        : null;

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
        {activeFilterChip}
        <SearchResults
          heading={heading}
          products={products}
          language={language}
          note={note}
          totalProducts={outcome.totalProducts}
        />
      </div>
    );
  }

  // ── Default view: browse categories and popular terms ───────
  const popularTerms: string[] = [];

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
      {selector}
      <RecentSearches />
      <PopularSearch searches={popularTerms} />
    </div>
  );
}
