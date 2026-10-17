import { ExternalLink, Package, Tag } from "lucide-react";
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
  /** Related products from the source's fetchrelated endpoint. */
  related?: Array<{ kind: string; product: ProductDetails }>;
  /** Server-side fetch timing, surfaced for latency tracking. */
  timings?: { totalMs: number } | null;
}

function availabilityClasses(availability: string): string {
  if (/in\s*stock/i.test(availability)) return "bg-chart-3/15 text-chart-3";
  if (/(out\s*of\s*stock|sold\s*out|discontinued)/i.test(availability)) {
    return "bg-destructive/15 text-destructive";
  }
  return "bg-muted text-muted-foreground";
}

function availabilityLabel(availability: string | null): string {
  if (!availability) return "";
  if (/in\s*stock/i.test(availability)) return "Available";
  if (/(out\s*of\s*stock|sold\s*out|discontinued)/i.test(availability)) {
    return "Unavailable";
  }
  return "Availability unknown";
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  related: "Related products",
  same_brand: "More from this brand",
  complementary: "Complementary products",
  alternative: "Alternative products",
  similar: "Similar products",
};

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
  related = [],
  timings = null,
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
  const brandLabel =
    language === "fa" ? product.brand_fa || product.brand : product.brand;

  const categories = await Promise.all(
    product.categories.map(async (category) => ({
      id: category.id,
      name: await localizeCategoryName(category, language),
    })),
  );

  const details = [
    { label: "Brand", value: brandLabel },
    { label: "Manufacturer", value: product.manufacturer },
    { label: "Form", value: product.form },
    { label: "Package size", value: product.package_size },
    { label: "SKU", value: product.sku },
    { label: "Barcode", value: product.barcode },
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item.value),
  );

  const variants = product.variants ?? [];
  const properties = product.properties ?? [];
  const availabilityText = availabilityLabel(product.availability);

  // Farsi view: right-to-left layout with the Vazirmatn font. Any other
  // language keeps the default LTR Latin typography untouched.
  const isFa = language === "fa";

  return (
    <div
      dir={isFa ? "rtl" : "ltr"}
      style={
        isFa
          ? { fontFamily: "var(--font-vazirmatn), var(--font-roboto)" }
          : undefined
      }
      className="flex flex-col gap-6 pt-2 pb-8"
    >
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
          <div className="flex shrink-0 flex-col items-end gap-1">
            {product.price != null ? (
              <span className="rounded-2xl bg-primary/10 px-3 py-1.5 text-base font-semibold text-primary">
                {product.price.toLocaleString()}
                {product.currency ? (
                  <span className="ml-1 text-sm font-normal opacity-70">
                    {product.currency}
                  </span>
                ) : null}
              </span>
            ) : null}
            {product.originalPrice != null &&
            product.originalPrice > (product.price ?? 0) ? (
              <span className="text-xs text-muted-foreground line-through">
                {product.originalPrice.toLocaleString()} {product.currency}
              </span>
            ) : null}
            {product.discountPercent != null && product.discountPercent > 0 ? (
              <span className="rounded-full bg-chart-3/15 px-2 py-0.5 text-[11px] font-semibold text-chart-3">
                {product.discountPercent}% off
              </span>
            ) : null}
          </div>
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

          {[brandLabel, product.form, product.package_size]
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
              {availabilityText || product.availability}
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
          {product.ingredientServing ? (
            <p className="text-sm text-muted-foreground">
              {product.ingredientServing}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-2xl border bg-card">
            {product.ingredients.map((ingredient, index) => {
              const label = ingredientName(ingredient, language);
              const altLabel =
                language === "fa"
                  ? ingredient.name_en && ingredient.name_en !== label
                    ? ingredient.name_en
                    : null
                  : ingredient.name_fa && ingredient.name_fa !== label
                    ? ingredient.name_fa
                    : null;
              const amount =
                ingredient.amount != null
                  ? `${ingredient.amount}${ingredient.unit ?? ""}`
                  : null;
              return (
                <div
                  key={`${label}-${index}`}
                  className={cn(
                    "flex flex-col gap-0.5 px-4 py-2.5",
                    index % 2 === 1 && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {label}
                    </span>
                    {amount ? (
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {amount}
                      </span>
                    ) : null}
                  </div>
                  {altLabel ? (
                    <span className="text-xs text-muted-foreground">
                      {altLabel}
                    </span>
                  ) : null}
                  {ingredient.daily_needed ? (
                    <span className="text-xs text-muted-foreground">
                      Daily requirement: {ingredient.daily_needed}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : product.detailLoaded === false ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Ingredients
          </h2>
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            Ingredients unavailable — the full source listing could not be
            retrieved. This does not mean the product has no ingredients.
          </p>
        </section>
      ) : null}

      {/* Variants */}
      {variants.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Variants ({variants.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5",
                  index > 0 && "border-t border-border/60",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {variant.title ?? `Variant ${variant.id}`}
                  {variant.isMaster ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Listed
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {variant.price != null ? (
                    <span className="font-medium tabular-nums">
                      {variant.price.toLocaleString()} {product.currency}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Price unknown</span>
                  )}
                  {variant.availability ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        availabilityClasses(variant.availability),
                      )}
                    >
                      {availabilityLabel(variant.availability)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Specifications */}
      {properties.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Specifications
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {properties.map((property, index) => (
              <div
                key={`${property.title}-${index}`}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5",
                  index > 0 && "border-t border-border/60",
                )}
              >
                <span className="text-sm text-muted-foreground">
                  {property.title}
                </span>
                <span className="min-w-0 truncate text-sm font-medium">
                  {property.value ?? "—"}
                </span>
              </div>
            ))}
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

      {/* Related products */}
      {related.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {RELATIONSHIP_LABELS[related[0]?.kind ?? ""] ?? "Related products"}
          </h2>
          <div className="flex flex-col gap-2">
            {related.map(({ kind, product: relatedProduct }) => {
              const relatedUrl = relatedProduct.canonical_url;
              const href = relatedUrl
                ? `/search/products/${relatedProduct.id}?url=${encodeURIComponent(relatedUrl)}`
                : `/search/products/${relatedProduct.id}`;
              const relatedImage = productImages(relatedProduct.image_urls)[0];
              return (
                <Link
                  key={`${kind}-${relatedProduct.id}`}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 shadow-sm transition-colors hover:border-primary/25"
                >
                  {relatedImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={relatedImage}
                      alt={relatedProduct.name}
                      loading="lazy"
                      className="size-12 shrink-0 rounded-xl border border-border/70 bg-muted object-cover"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted text-muted-foreground">
                      <Package className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {localizedName(relatedProduct, language)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {RELATIONSHIP_LABELS[kind] ?? kind}
                    </span>
                  </span>
                </Link>
              );
            })}
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

      {timings ? (
        <p className="text-[11px] text-muted-foreground/60">
          Fetched in {(timings.totalMs / 1000).toFixed(1)}s
        </p>
      ) : null}
    </div>
  );
}
