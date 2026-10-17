import { cache } from "react";
import Link from "next/link";
import SinglePage from "@/components/products/SinglePage";
import {
  getProductBySourceId,
  getProductByUrl,
  getRelatedProductsFor,
} from "@/lib/darukade/service";
import { getServerLanguage } from "@/lib/i18n-server";
import type { ProductDetails } from "@/types/database";

interface ProductPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ url?: string }>;
}

/** Fetch + timing, wrapped in `cache` so render stays pure and deduped. */
const loadProductPage = cache(
  async (
    id: string,
    url?: string,
  ): Promise<{
    product: ProductDetails | null;
    error: string | null;
    totalMs: number;
  }> => {
    const startedAt = Date.now();
    let product: ProductDetails | null = null;
    let error: string | null = null;
    try {
      if (url) {
        product = await getProductByUrl(url);
      } else {
        product = await getProductBySourceId(id);
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Unknown error";
    }
    return { product, error, totalMs: Date.now() - startedAt };
  },
);

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const language = await getServerLanguage();

  const { product, error, totalMs } = await loadProductPage(id, sp?.url);

  if (!product) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <h1 className="text-2xl font-bold">Product unavailable</h1>
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-sm text-muted-foreground">
          {error ??
            "The product could not be retrieved from Darukade right now."}
        </p>
        <p className="rounded-2xl border border-border bg-muted/40 px-5 py-4 text-xs text-muted-foreground">
          Darukade product pages only exist under their category path, so an
          unknown ID cannot be resolved. Please open the product from a search
          result instead.
        </p>
        <Link
          href="/search"
          className="inline-flex w-fit rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to search
        </Link>
      </div>
    );
  }

  const related = await getRelatedProductsFor(id);
  return (
    <SinglePage
      product={product}
      language={language}
      related={related}
      timings={{ totalMs }}
    />
  );
}
