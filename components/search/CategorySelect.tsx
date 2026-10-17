"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutGrid, Tag, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/lib/i18n";

export interface CategoryChip {
  /** Source menu node id (URL param value). */
  id: string;
  /** Persian title from the source. */
  title: string;
  /** Display label — English when the UI language is English. */
  label: string;
}

interface CategorySelectProps {
  /** Top-level (parent) categories from Darukade's verified navigation. */
  parents: CategoryChip[];
  /** Currently selected category id (`cat` param), when present. */
  selectedId: string | null;
  /** Display label of the selected category. */
  selectedLabel: string | null;
  /** Parent category that contains the selection (or the selection itself). */
  selectedParentId: string | null;
  /** Pre-loaded children of the selected parent. */
  initialChildren: CategoryChip[];
  language: LanguageCode;
  /**
   * Render only the active-filter chip. Used on search-result screens, where
   * the full category filter stays hidden until the user searches again.
   */
  activeOnly?: boolean;
}

interface SubcategoryPayload {
  id: string;
  title: string;
  label?: string | null;
}

/**
 * Category filter for the product search: parent categories as chips, their
 * subcategories revealed underneath, subcategory clicks navigate to the
 * filtered product listing. Options come from Darukade's own navigation tree
 * (verified server-side) — nothing here is guessed.
 */
export default function CategorySelect({
  parents,
  selectedId,
  selectedLabel,
  selectedParentId,
  initialChildren,
  language,
  activeOnly = false,
}: CategorySelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expandedId, setExpandedId] = useState<string | null>(selectedParentId);
  const [childrenByParent, setChildrenByParent] = useState<
    Record<string, CategoryChip[]>
  >(selectedParentId ? { [selectedParentId]: initialChildren } : {});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function navigate(nextCategory: string | null) {
    const params = new URLSearchParams();
    const q = searchParams.get("q")?.trim();
    if (q) params.set("q", q);
    if (nextCategory) params.set("cat", nextCategory);
    const qs = params.toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`);
  }

  function handleParentClick(parentId: string) {
    if (expandedId === parentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(parentId);
    if (childrenByParent[parentId]) return;
    setLoadingId(parentId);
    void (async () => {
      try {
        const response = await fetch(
          `/api/categories/${parentId}?lang=${language}`,
        );
        if (!response.ok) {
          setChildrenByParent((current) => ({
            ...current,
            [parentId]: [],
          }));
          return;
        }
        const data = (await response.json()) as {
          subcategories?: SubcategoryPayload[];
        };
        const children: CategoryChip[] = (data.subcategories ?? []).map(
          (child) => ({
            id: child.id,
            title: child.title,
            label: child.label ?? child.title,
          }),
        );
        setChildrenByParent((current) => ({
          ...current,
          [parentId]: children,
        }));
      } catch {
        setChildrenByParent((current) => ({ ...current, [parentId]: [] }));
      } finally {
        setLoadingId(null);
      }
    })();
  }

  const expandedParent = parents.find((parent) => parent.id === expandedId);
  const expandedChildren = expandedId
    ? (childrenByParent[expandedId] ?? [])
    : [];
  const expandedParentLabel =
    expandedParent?.label ??
    (selectedParentId === expandedId ? selectedLabel : null) ??
    "Category";

  // Results screens: only the active filter (with a clear button), never the
  // full category explorer.
  if (activeOnly) {
    if (!selectedId || !selectedLabel) return null;
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="truncate">Showing: {selectedLabel}</span>
          <button
            type="button"
            aria-label="Clear category filter"
            onClick={() => navigate(null)}
            className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-primary/20"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Parent categories */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            !selectedId
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
          )}
        >
          <LayoutGrid className="size-4" />
          All categories
        </button>

        {parents.map((parent) => {
          const expanded = expandedId === parent.id;
          const active = selectedParentId === parent.id;
          return (
            <button
              key={parent.id}
              type="button"
              onClick={() => handleParentClick(parent.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
              )}
            >
              {parent.label}
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Subcategories of the expanded parent */}
      {expandedId ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-3">
          <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Tag className="size-3.5" />
            {expandedParentLabel} subcategories
          </p>

          {loadingId === expandedId ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  key={index}
                  className="h-8 w-24 animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(expandedId)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  selectedId === expandedId
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                )}
              >
                All in {expandedParentLabel}
              </button>

              {expandedChildren.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => navigate(child.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedId === child.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                  )}
                >
                  {child.label}
                </button>
              ))}

              {expandedChildren.length === 0 ? (
                <span className="px-1 text-xs text-muted-foreground">
                  No subcategories — browse the whole category.
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Active filter + reset */}
      {selectedId && selectedLabel ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <span className="truncate">Showing: {selectedLabel}</span>
            <button
              type="button"
              aria-label="Clear category filter"
              onClick={() => navigate(null)}
              className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-primary/20"
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
