import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type {
  MedicalReference,
  MedicalSearchResult,
  ReferenceRecordType,
} from "@/lib/medical-reference";

const RECORD_TYPE_LABEL: Record<ReferenceRecordType, string> = {
  medical_topic: "Health topic",
  research: "Research",
  drug_label: "Drug label",
  ingredient: "Ingredient",
  terminology: "Drug terminology",
};

function detailHref(reference: MedicalReference): string {
  const params = new URLSearchParams({
    source: reference.source,
    id: reference.externalId,
    title: reference.title,
  });
  return `/reference/detail?${params.toString()}`;
}

interface ReferenceResultListProps {
  result: MedicalSearchResult;
  language: "en" | "fa";
}

/**
 * Renders unified search results with per-record source attribution, record
 * type, summary (only when the source provides one) and links to the original
 * record. Never invents summaries or dates.
 */
export function ReferenceResultList({
  result,
  language,
}: ReferenceResultListProps) {
  void language;
  const { results, sources, partial } = result;

  const failedSources = sources.filter((source) => !source.ok);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-base font-semibold">
          Results
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            ({results.length})
          </span>
        </h2>
      </div>

      {partial ? (
        <p className="rounded-2xl border border-warning/30 bg-warning-background px-4 py-3 text-xs text-foreground/90">
          Some sources could not be reached right now, so results may be
          incomplete:{" "}
          {failedSources.map((source) => source.source).join(", ")}. Sources that
          were available are shown below.
        </p>
      ) : null}

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {partial
            ? "No results were returned from the sources that could be reached."
            : "No results found. Try a different term or category."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((reference) => (
            <li key={`${reference.source}:${reference.externalId}`}>
              <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-snug">
                      <Link
                        href={detailHref(reference)}
                        className="hover:underline"
                      >
                        {reference.title}
                      </Link>
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {RECORD_TYPE_LABEL[reference.recordType]}
                      </span>
                      <span>{reference.sourceLabel}</span>
                      {reference.updatedAt ? (
                        <span>· {reference.updatedAt}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {reference.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {reference.summary}
                  </p>
                ) : null}

                {reference.recordType === "research" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {reference.abstractAvailable
                      ? "Abstract available."
                      : "Abstract not available."}{" "}
                    {reference.fullTextAvailable
                      ? "Free full text may be available."
                      : "Free full text not indicated."}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-4 text-xs">
                  <Link
                    href={detailHref(reference)}
                    className="font-medium text-primary hover:underline"
                  >
                    Details
                  </Link>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    View on {reference.sourceLabel}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Results link to the original sources. Coverage is not universal,
        especially for Persian product names or locally marketed medicines.
      </p>
    </div>
  );
}
