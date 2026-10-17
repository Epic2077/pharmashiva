import BackLink from "@/components/shared/BackLink";

/** Skeleton shown while the product detail page fetches from Darukade. */
export default function ProductPageLoading() {
  return (
    <div className="flex flex-col gap-6 pt-2 pb-8">
      <BackLink title="Back to Products" />

      <div className="h-72 w-full animate-pulse rounded-2xl bg-muted" />

      <div className="flex flex-col gap-3">
        <div className="h-7 w-2/3 animate-pulse rounded-xl bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded-xl bg-muted" />
        <div className="h-6 w-28 animate-pulse rounded-2xl bg-muted" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-muted" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
