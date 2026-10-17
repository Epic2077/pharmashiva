"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Package, ShoppingBag, Tag, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { Button } from "@/components/ui/button";
import { localizedName, type LanguageCode } from "@/lib/i18n";
import { primaryProductImage } from "@/lib/product-images";
import type { ProductDetails } from "@/types/database";

interface ProductDialogProps {
  product: ProductDetails;
  /** Localized leaf-category name (computed server-side). */
  categoryName: string | null;
  language: LanguageCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductDialog({
  product,
  categoryName,
  language,
  open,
  onOpenChange,
}: ProductDialogProps) {
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

  // Same back-button behavior as the chat preview dialog: while open, the
  // dialog owns a history entry so Back closes it instead of leaving the page.
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ productPreview: product.id }, "");
    pushedRef.current = true;

    const handlePopState = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      onOpenChange(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [open, product.id, onOpenChange]);

  const handleClose = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenProduct = useCallback(() => {
    pushedRef.current = false;
    onOpenChange(false);
    const url = product.canonical_url;
    const href = url
      ? `/search/products/${product.id}?url=${encodeURIComponent(url)}`
      : `/search/products/${product.id}`;
    router.replace(href);
  }, [product.id, product.canonical_url, onOpenChange, router]);

  const metaTags = [product.form, product.package_size, product.availability]
    .filter(Boolean)
    .map(String);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(next);
        else handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{name}</DialogTitle>
              {secondary ? (
                <DialogDescription className="truncate text-xs">
                  {secondary}
                </DialogDescription>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close details"
              className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div
            className="flex cursor-pointer items-start gap-3"
            onClick={handleOpenProduct}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={name}
                className="size-24 shrink-0 rounded-xl border border-border/70 bg-muted object-cover"
              />
            ) : (
              <span className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted text-muted-foreground">
                <Package className="size-8" />
              </span>
            )}

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <div className="flex items-center justify-between gap-1.5">
                {product.price != null ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {product.price.toLocaleString()}
                    {product.currency ? (
                      <span className="font-normal opacity-70">
                        {" "}
                        {product.currency}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {product.brand != null ? (
                  <span className="rounded-full flex gap-1.5 border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    <ShoppingBag className="size-3" />
                    {product.brand}
                  </span>
                ) : null}
              </div>

              {categoryName ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <Tag className="size-3" />
                  {categoryName}
                </span>
              ) : null}

              {metaTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ingredients ({product.ingredients.length})
            </p>
            {product.ingredients.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                {product.detailLoaded === false
                  ? "Ingredients unavailable — open the product page to fetch them."
                  : "No ingredients listed."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {product.ingredients.map((ingredient, index) => {
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
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3">
          <Button className="w-full rounded-full" onClick={handleOpenProduct}>
            View full details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
