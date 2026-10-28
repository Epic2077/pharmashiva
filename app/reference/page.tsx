import { Suspense } from "react";
import Title from "@/components/shared/Title";
import { ReferenceSearchBar } from "@/components/reference/ReferenceSearchBar";
import { ReferenceFilters } from "@/components/reference/ReferenceFilters";
import { ReferenceResultList } from "@/components/reference/ReferenceResultList";
import {
  isReferenceFilter,
  searchMedicalReferences,
} from "@/lib/medical-reference";
import { getServerLanguage } from "@/lib/i18n-server";

interface ReferencePageProps {
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function ReferencePage({
  searchParams,
}: ReferencePageProps) {
  const { q, filter } = await searchParams;
  const query = q?.trim() ?? "";
  const activeFilter = isReferenceFilter(filter) ? filter : "all";
  const language = await getServerLanguage();

  const searchBar = (
    <Suspense
      fallback={<div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />}
    >
      <ReferenceSearchBar initialQuery={query} />
    </Suspense>
  );

  if (!query) {
    return (
      <div className="flex flex-col gap-8 pt-2">
        <Title
          title="Medical Reference"
          subtitle="Evidence-backed medical information for pharmacists"
          profile
        />
        {searchBar}
        <ReferenceFilters query="" active={activeFilter} />
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          Search medical definitions, conditions and symptoms, drug labels,
          active ingredients and supplements, and biomedical research. Every
          result links to its original source. Coverage is not universal —
          especially for Persian product names or locally marketed medicines.
        </p>
      </div>
    );
  }

  const result = await searchMedicalReferences({
    query,
    filter: activeFilter,
    language,
  });

  return (
    <div className="flex flex-col gap-8 pt-2">
      <Title title="Medical Reference" subtitle={`Results for “${query}”`} profile />
      {searchBar}
      <ReferenceFilters query={query} active={activeFilter} />
      <ReferenceResultList result={result} language={language} />
    </div>
  );
}
