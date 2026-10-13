import type { Product } from "@/types/database";

interface SearchResultsProps {
  heading: string;
  products: Product[];
}

export default function SearchResults({ heading, products }: SearchResultsProps) {
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
        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{product.name}</p>
                  {product.name_en && product.name_en !== product.name ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {product.name_en}
                    </p>
                  ) : null}
                  {product.brand ? (
                    <p className="text-xs text-muted-foreground">{product.brand}</p>
                  ) : null}
                </div>
                {product.price != null ? (
                  <p className="shrink-0 text-sm font-semibold">
                    {product.price.toLocaleString()}
                    {product.currency ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        {product.currency}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[product.form, product.package_size, product.availability]
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
