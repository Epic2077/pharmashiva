import ProductCardList from "@/components/products/ProductCardList";
import { localizeCategoryName } from "@/lib/i18n-server";
import type { ProductDetails } from "@/types/database";
import type { LanguageCode } from "@/lib/i18n";

interface SearchResultsProps {
  heading: string;
  products: ProductDetails[];
  language: LanguageCode;
}

export default async function SearchResults({
  heading,
  products,
  language,
}: SearchResultsProps) {
  // Precompute the localized category name per product on the server, so the
  // cards stay compact client components.
  const items = await Promise.all(
    products.map(async (product) => ({
      product,
      categoryName: product.categories[0]
        ? await localizeCategoryName(product.categories[0], language)
        : null,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="px-1 text-base font-semibold">
        {heading}
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          ({products.length})
        </span>
      </h2>

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
