"use client";

import { useEffect, useRef, useState } from "react";
import { Package, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { localizedName, type LanguageCode } from "@/lib/i18n";
import type { ProductDetails } from "@/types/database";
import { Badge } from "../ui/badge";
import { redirect } from "next/navigation";

const HOLD_DURATION = 450;
const MAX_VISIBLE_INGREDIENTS = 1;

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
  const name = localizedName(product, language);
  const secondary =
    language === "en"
      ? product.name_fa && product.name_fa !== name
        ? product.name_fa
        : undefined
      : product.name_en && product.name_en !== name
        ? product.name_en
        : undefined;

  const imageUrl = product.image_urls?.find((url) => url && url.trim());

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
      onClick={() => redirect(`/search/products/${product.id}`)}
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
          {product.brand != null && (
            <Badge className="flex gap-1.5 text-xs">{product.brand}</Badge>
          )}
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
          {categoryName ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <Tag className="size-3" />
              {categoryName}
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
                onClick={onOpen}
                aria-label={`Show all ${product.ingredients.length} ingredients`}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                +{hiddenCount} more
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
