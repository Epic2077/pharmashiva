import ProductCardList from "@/components/products/ProductCardList";
import { localizeCategoryName } from "@/lib/i18n-server";
import type { ProductDetails } from "@/types/database";
import type { LanguageCode } from "@/lib/i18n";

interface SearchResultsProps {
  heading: string;
  products: ProductDetails[];
  language: LanguageCode;
  /** Category-constraint caveat from the source, when present. */
  note?: string | null;
  /** Total product count the source reported for this search. */
  totalProducts?: number;
}

/** Bounded category localization so cold translation caches never stall cards. */
async function localizeCategorySafe(
  category: { name: string } | undefined,
  language: LanguageCode,
): Promise<string | null> {
  if (!category) return null;
  if (language === "fa") return category.name;
  try {
    return await Promise.race([
      localizeCategoryName(category, language),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(category.name), 700);
      }),
    ]);
  } catch {
    return category.name;
  }
}

export default async function SearchResults({
  heading,
  products,
  language,
  note = null,
  totalProducts,
}: SearchResultsProps) {
  // Precompute the localized category name per product on the server, so the
  // cards stay compact client components. Missing localization falls back to
  // the source's Persian category name.
  const items = await Promise.all(
    products.map(async (product) => ({
      product,
      categoryName: await localizeCategorySafe(product.categories[0], language),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="px-1 text-base font-semibold">
        {heading}
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          ({products.length}
          {totalProducts !== undefined && totalProducts > products.length
            ? ` of ${totalProducts}`
            : ""}
          )
        </span>
      </h2>

      {note ? (
        <p className="rounded-2xl border border-warning/30 bg-warning-background px-4 py-3 text-xs text-foreground/90">
          {note}
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          No products found.
        </p>
      ) : (
        <ProductCardList items={items} language={language} />
      )}
    </div>
  );
}
