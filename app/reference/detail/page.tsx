import { Suspense } from "react";
import { redirect } from "next/navigation";
import BackLink from "@/components/shared/BackLink";
import { ReferenceDetailView } from "@/components/reference/ReferenceDetailView";

interface ReferenceDetailPageProps {
  searchParams: Promise<{ source?: string; id?: string; title?: string }>;
}

const KNOWN_SOURCES = new Set([
  "medlineplus",
  "pubmed",
  "dailymed",
  "rxnorm",
  "pubchem",
]);

export default async function ReferenceDetailPage({
  searchParams,
}: ReferenceDetailPageProps) {
  const { source, id, title } = await searchParams;
  if (!source || !KNOWN_SOURCES.has(source) || !id) {
    redirect("/reference");
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <BackLink title="Medical Reference" link="/reference" />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <div className="h-8 w-2/3 animate-pulse rounded-2xl bg-muted" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-muted" />
          </div>
        }
      >
        <ReferenceDetailView
          source={source}
          id={id}
          title={title?.slice(0, 300) ?? ""}
        />
      </Suspense>
    </div>
  );
}
