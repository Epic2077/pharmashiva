"use client";

import { Info, PackageSearch, TriangleAlert } from "lucide-react";
import ProductCardList from "@/components/products/ProductCardList";
import type { LanguageCode } from "@/lib/i18n";
import type { ProductRecommendation } from "@/types/ai";

interface ChatProductListProps {
  products: ProductRecommendation[];
  language: LanguageCode;
  provisional: boolean;
  databaseAvailable: boolean;
}

/** Localized display name for the "why" list (mirrors ProductCard logic). */
function displayName(product: ProductRecommendation["product"], language: LanguageCode) {
  if (language === "fa") return product.name_fa || product.name;
  return product.name_en || product.name;
}

/**
 * Product recommendations inside the chat, rendered with the existing
 * `ProductCardList`/`ProductCard` so they look identical to the search screens.
 */
export function ChatProductList({
  products,
  language,
  provisional,
  databaseAvailable,
}: ChatProductListProps) {
  if (!databaseAvailable) {
    return (
      <aside className="my-3 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-background px-4 py-3 text-sm text-foreground/90">
        <Info size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <span>
          Product lookup is temporarily unavailable, so no products can be shown
          right now. The safety assessment above is unaffected.
        </span>
      </aside>
    );
  }

  if (products.length === 0) {
    return (
      <p className="my-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        No suitable matching products were found in the current catalog.
      </p>
    );
  }

  const items = products.map((item) => ({
    product: item.product,
    categoryName: item.categoryName,
  }));

  return (
    <section className="my-3">
      <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-primary">
        <PackageSearch size={16} aria-hidden="true" />
        <span>{provisional ? "Provisional products" : "Product suggestions"}</span>
      </div>

      {provisional ? (
        <p className="mb-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-background px-3 py-2 text-xs text-foreground/90">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Not yet recommended while the safety questions above remain
            unresolved.
          </span>
        </p>
      ) : null}

      <ProductCardList items={items} language={language} />

      <details className="mt-2 rounded-xl border border-border bg-card px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Why these products
        </summary>
        <ul className="mt-2 space-y-2">
          {products.map((item) => (
            <li key={item.product.id} className="text-xs leading-5">
              <span className="font-medium text-foreground">
                {displayName(item.product, language)}
              </span>
              <span className="text-muted-foreground"> — {item.reason}</span>
              {item.compatibility === "unknown" ? (
                <span className="block text-warning">
                  Allergy compatibility could not be confirmed.
                </span>
              ) : null}
              {item.warnings.map((warning) => (
                <span key={warning} className="block text-muted-foreground">
                  {warning}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
