"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, ShoppingBag, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { localizedName, type LanguageCode } from "@/lib/i18n";
import { primaryProductImage } from "@/lib/product-images";
import type { ProductDetails } from "@/types/database";

const HOLD_DURATION = 450;
/** Up to two meaningful ingredients, in the source's own order. */
const MAX_VISIBLE_INGREDIENTS = 2;

interface ProductCardProps {
  product: ProductDetails;
  /** Localized leaf-category name (computed server-side). */
  categoryName: string | null;
  language: LanguageCode;
  /** Opens the full-details dialog. */
  onOpen: () => void;
}

export default function ProductCard({
  product,
  categoryName,
  language,
  onOpen,
}: ProductCardProps) {
  const router = useRouter();
  const name = localizedName(product, language);
  const secondary =
    language === "en"
      ? product.name_fa && product.name_fa !== name
        ? product.name_fa
        : undefined
      : product.name_en && product.name_en !== name
        ? product.name_en
        : undefined;

  const imageUrl = primaryProductImage(product.image_urls);

  // Verified category label: the server-computed localized name when present,
  // otherwise the source category from the navigation tree.
  const categoryLabel = categoryName ?? product.categories[0]?.name ?? null;

  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }

  function handlePointerDown() {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      onOpen();
    }, HOLD_DURATION);
  }

  function handleOpen() {
    // The source has no ID-only product URL, so the canonical URL travels
    // with the navigation.
    const url = product.canonical_url;
    const href = url
      ? `/search/products/${product.id}?url=${encodeURIComponent(url)}`
      : `/search/products/${product.id}`;
    router.push(href);
  }

  // Structured ingredients were fetched only when `detailLoaded` is true;
  // otherwise we must not imply the product has no ingredients.
  const ingredientsKnown = product.detailLoaded !== false;
  const visibleIngredients = product.ingredients.slice(
    0,
    MAX_VISIBLE_INGREDIENTS,
  );
  const hiddenCount = product.ingredients.length - visibleIngredients.length;

  return (
    <article
      onPointerDown={handlePointerDown}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      onContextMenu={(event) => event.preventDefault()}
      onClick={handleOpen}
      className={cn(
        "flex touch-pan-y select-none gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-colors hover:border-primary/25 sm:gap-3.5 sm:p-4",
        holding && "scale-[0.99] opacity-90",
      )}
    >
      {imageUrl ? (
        <div className="flex flex-col items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="size-20 shrink-0 self-start rounded-xl border border-border/70 bg-muted object-cover sm:size-24"
          />
          {product.brand ? (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <ShoppingBag className="size-3 shrink-0" />
              <span className="truncate">{product.brand}</span>
            </span>
          ) : null}
        </div>
      ) : (
        <span className="flex size-20 shrink-0 self-start items-center justify-center rounded-xl border border-border/70 bg-muted text-muted-foreground sm:size-24">
          <Package className="size-7 sm:size-9" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h4 className="text-sm font-semibold leading-snug sm:text-[15px]">
          {name}
        </h4>
        <div className="flex items-center justify-between gap-1.5">
          {secondary ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {secondary}
            </span>
          ) : null}
          {product.price != null ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {product.price.toLocaleString()}
              {product.currency ? (
                <span className="font-normal opacity-70">
                  {" "}
                  {product.currency}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categoryLabel ? (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <Tag className="size-3 shrink-0" />
              <span className="truncate">{categoryLabel}</span>
            </span>
          ) : null}
        </div>

        {product.ingredients.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {visibleIngredients.map((ingredient, index) => {
              const ingredientName =
                language === "fa"
                  ? ingredient.name_fa || ingredient.name
                  : ingredient.name_en || ingredient.name;
              return (
                <span
                  key={`${ingredientName}-${index}`}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {ingredientName}
                  {ingredient.amount != null ? (
                    <span className="opacity-70">
                      {" "}
                      · {ingredient.amount}
                      {ingredient.unit}
                    </span>
                  ) : null}
                </span>
              );
            })}

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                aria-label={`Show all ${product.ingredients.length} ingredients`}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                +{hiddenCount} more
              </button>
            ) : null}
          </div>
        ) : ingredientsKnown ? null : (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            Ingredients unavailable
          </p>
        )}
      </div>
    </article>
  );
}
