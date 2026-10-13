export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-1">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
