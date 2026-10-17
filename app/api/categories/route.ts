import {
  getCategoryTree,
  requestForCategoryNode,
} from "@/lib/darukade/categories";
import type { DarukadeCategoryNode } from "@/lib/darukade/types";

export interface CategoryNodeDto {
  id: string;
  title: string;
  url: string;
  parentId: string | null;
  depth: number;
  searchable: boolean;
  children: CategoryNodeDto[];
}

function toDto(
  node: DarukadeCategoryNode,
  maxDepth: number,
  depth = 0,
): CategoryNodeDto | null {
  const request = requestForCategoryNode(node);
  return {
    id: node.id !== null ? String(node.id) : node.url,
    title: node.title,
    url: node.url,
    parentId: node.parentId !== null ? String(node.parentId) : null,
    depth,
    searchable: request.kind !== "unsupported",
    children:
      depth < maxDepth
        ? node.children
            .map((child) => toDto(child, maxDepth, depth + 1))
            .filter((child): child is CategoryNodeDto => child !== null)
        : [],
  };
}

/**
 * Verified Darukade category hierarchy, straight from the source's own
 * navigation data (`headerFooterData.header.menus`). No guessed categories.
 */
export async function GET() {
  try {
    const tree = await getCategoryTree();
    const categories = tree
      .map((node) => toDto(node, 2))
      .filter((node): node is CategoryNodeDto => node !== null);
    return Response.json({ categories, source: "darukade-navigation" });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Category data unavailable",
      },
      { status: 502 },
    );
  }
}
