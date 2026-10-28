"use client";

import { useState } from "react";
import ProductCard from "./ProductCard";
import ProductDialog from "./ProductDialog";
import type { ProductDetails } from "@/types/database";
import type { LanguageCode } from "@/lib/i18n";

export interface ProductListItem {
  product: ProductDetails;
  /** Localized leaf-category name (computed server-side). */
  categoryName: string | null;
}

interface ProductCardListProps {
  items: ProductListItem[];
  language: LanguageCode;
  /** Show as a two-column grid on desktop (listing pages). */
  columns?: 1 | 2;
}

export default function ProductCardList({
  items,
  language,
  columns = 1,
}: ProductCardListProps) {
  const [preview, setPreview] = useState<ProductListItem | null>(null);

  return (
    <>
      <div
        className={
          columns === 2
            ? "grid gap-3 lg:grid-cols-2"
            : "flex flex-col gap-3"
        }
      >
        {items.map((item) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            categoryName={item.categoryName}
            language={language}
            onOpen={() => setPreview(item)}
          />
        ))}
      </div>

      {preview ? (
        <ProductDialog
          product={preview.product}
          categoryName={preview.categoryName}
          language={language}
          open
          onOpenChange={(next) => {
            if (!next) setPreview(null);
          }}
        />
      ) : null}
    </>
  );
}
