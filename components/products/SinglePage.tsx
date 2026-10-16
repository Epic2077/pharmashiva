import { ExternalLink, Tag } from "lucide-react";
import Link from "next/link";
import BackLink from "@/components/shared/BackLink";
import ProductDescription from "@/components/products/ProductDescription";
import ProductGallery from "@/components/products/ProductGallery";
import { cn } from "@/lib/utils";
import { localizedName, type LanguageCode } from "@/lib/i18n";
import { localizeCategoryName } from "@/lib/i18n-server";
import { productImages } from "@/lib/product-images";
import type { ProductDetails } from "@/types/database";

interface SinglePageProps {
  product: ProductDetails;
  language: LanguageCode;
}

function availabilityClasses(availability: string): string {
  if (/in\s*stock/i.test(availability)) return "bg-chart-3/15 text-chart-3";
  if (/(out\s*of\s*stock|sold\s*out|discontinued)/i.test(availability)) {
    return "bg-destructive/15 text-destructive";
  }
  return "bg-muted text-muted-foreground";
}

function ingredientName(
  ingredient: ProductDetails["ingredients"][number],
  language: LanguageCode,
): string {
  return language === "fa"
    ? ingredient.name_fa || ingredient.name
    : ingredient.name_en || ingredient.name;
}

export default async function SinglePage({
  product,
  language,
}: SinglePageProps) {
  const name = localizedName(product, language);
  const secondary =
    language === "en"
      ? product.name_fa && product.name_fa !== name
        ? product.name_fa
        : undefined
      : product.name_en && product.name_en !== name
        ? product.name_en
        : undefined;

  const images = productImages(product.image_urls);

  const categories = await Promise.all(
    product.categories.map(async (category) => ({
      id: category.id,
      name: await localizeCategoryName(category, language),
    })),
  );

  const details = [
    { label: "Brand", value: product.brand },
    { label: "Manufacturer", value: product.manufacturer },
    { label: "Form", value: product.form },
    { label: "Package size", value: product.package_size },
    { label: "SKU", value: product.sku },
    { label: "Barcode", value: product.barcode },
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item.value),
  );

  return (
    <div className="flex flex-col gap-6 pt-2 pb-8">
      <BackLink title="Back to Products" />

      {/* Image gallery */}
      <ProductGallery key={product.id} images={images} name={name} />

      {/* Title + price */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{name}</h1>
            {secondary ? (
              <p className="mt-1 text-sm text-muted-foreground">{secondary}</p>
            ) : null}
          </div>
          {product.price != null ? (
            <span className="shrink-0 rounded-2xl bg-primary/10 px-3 py-1.5 text-base font-semibold text-primary">
              {product.price.toLocaleString()}
              {product.currency ? (
                <span className="ml-1 text-sm font-normal opacity-70">
                  {product.currency}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Tag className="size-3" />
              {category.name}
            </Link>
          ))}

          {[product.brand, product.form, product.package_size]
            .filter(Boolean)
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}

          {product.availability ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                availabilityClasses(product.availability),
              )}
            >
              {product.availability}
            </span>
          ) : null}
        </div>
      </div>

      {/* Description */}
      {product.description ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Description
          </h2>
          <ProductDescription text={product.description} />
        </section>
      ) : null}

      {/* Ingredients */}
      {product.ingredients.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Ingredients ({product.ingredients.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {product.ingredients.map((ingredient, index) => {
              const label = ingredientName(ingredient, language);
              const amount =
                ingredient.amount != null
                  ? `${ingredient.amount}${ingredient.unit ?? ""}`
                  : null;
              return (
                <div
                  key={`${label}-${index}`}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-2.5",
                    index % 2 === 1 && "bg-accent",
                  )}
                >
                  <span className="min-w-0 truncate text-sm">{label}</span>
                  {amount ? (
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {amount}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Details */}
      {details.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Details
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {details.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5",
                  index > 0 && "border-t border-border/60",
                )}
              >
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <span className="min-w-0 truncate text-sm font-medium">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {product.canonical_url ? (
        <a
          href={product.canonical_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ExternalLink className="size-3.5" />
          View original listing
        </a>
      ) : null}
    </div>
  );
}
