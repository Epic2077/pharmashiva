import { ExternalLink, Sparkles } from "lucide-react";
import {
  getMedicalReferenceDetail,
  stubReference,
  type MedicalReference,
  type MedicalSource,
} from "@/lib/medical-reference";
import { explainReference } from "@/lib/medical-reference/explain";

const SOURCES: MedicalSource[] = [
  "medlineplus",
  "pubmed",
  "dailymed",
  "rxnorm",
  "pubchem",
];

interface ReferenceDetailViewProps {
  source: string;
  id: string;
  title: string;
}

/**
 * Server-rendered detail view. Re-fetches the record from its source by
 * identifier, renders the structured sections, and appends a clearly-labeled
 * AI explanation that is grounded only in the retrieved source text.
 */
export async function ReferenceDetailView({
  source,
  id,
  title,
}: ReferenceDetailViewProps) {
  const medicalSource = SOURCES.includes(source as MedicalSource)
    ? (source as MedicalSource)
    : null;
  const reference: MedicalReference = stubReference(
    medicalSource ?? "medlineplus",
    id,
    title,
  );

  if (!medicalSource) {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6 text-sm text-destructive">
        Unknown source. This record cannot be displayed.
      </p>
    );
  }

  let detail;
  try {
    detail = await getMedicalReferenceDetail(medicalSource, id, reference);
  } catch (error) {
    console.error(
      `[reference] detail fetch failed (${medicalSource}):`,
      error,
    );
    detail = null;
  }

  const explanation = detail
    ? await explainReference(detail, detail.reference)
    : { text: "", generated: false };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold leading-snug">{reference.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {reference.sourceLabel}
          </span>
          {detail?.reference.updatedAt ? (
            <span>Updated {detail.reference.updatedAt}</span>
          ) : null}
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            View original record
            <ExternalLink className="size-3" />
          </a>
        </div>
      </header>

      {!detail ? (
        <p className="rounded-2xl border border-warning/30 bg-warning-background px-4 py-4 text-sm text-foreground/90">
          This record could not be retrieved from its source right now. You can
          still open the original record above.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {detail.sections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                No structured sections are available for this record. Use the
                link above to read the full source.
              </p>
            ) : (
              detail.sections.map((section) => (
                <section
                  key={section.heading}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <h2 className="mb-2 text-sm font-semibold">
                    {section.heading}
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {section.body}
                  </p>
                </section>
              ))
            )}
          </div>

          {explanation.generated ? (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" />
                AI explanation
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {explanation.text}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Generated from the source text above. This is an explanation,
                not a diagnosis or a substitute for professional judgment.
              </p>
            </section>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Source-provided facts and AI explanations are shown separately.
            Information unavailable from the source is not fabricated.
          </p>
        </>
      )}
    </div>
  );
}
