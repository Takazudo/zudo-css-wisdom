/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — category-tree-nav moved to the package (epic #2344, S8).
// Calls `createCategoryTreeNavWrapper(deps)` from
// @takazudo/zudo-doc/category-tree-nav with host singletons injected,
// then re-exports the resulting component so all existing call sites continue
// to work unchanged.

import { createCategoryTreeNavWrapper } from "@takazudo/zudo-doc/category-tree-nav";
import type {
  CategoryTreeNavNode,
  CategoryTreeNavSource,
} from "@takazudo/zudo-doc/category-tree-nav";
import { buildNavTree, groupSatelliteNodes, findNode, type NavNode } from "@/utils/docs";
import { defaultLocale, type Locale } from "@/config/i18n";
import type { DocsEntry } from "@/types/docs-entry";
import type { CategoryMeta } from "@/utils/docs";
import { resolveNavSource } from "./_nav-source-docs";

export type { CategoryTreeNavWrapperProps } from "@takazudo/zudo-doc/category-tree-nav";

// The factory describes its injected nav helpers with the minimal
// CategoryTreeNavNode view (no `slug` / `position`), while the host helpers are
// typed against the full NavNode. At runtime the nodes are real NavNodes; the
// wrappers re-view them as the minimal type at the injection boundary (cast via
// `unknown` because NavNode is a structural supertype of CategoryTreeNavNode,
// so a direct cast is rejected as non-overlapping).
export const CategoryTreeNavWrapper = createCategoryTreeNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => CategoryTreeNavSource,
  buildNavTree: (docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs as DocsEntry[],
      locale as Locale,
      categoryMeta as Map<string, CategoryMeta>,
    ) as unknown as CategoryTreeNavNode[],
  groupSatelliteNodes: (tree: CategoryTreeNavNode[], prefixes: string[]) =>
    groupSatelliteNodes(tree as unknown as NavNode[], prefixes) as unknown as CategoryTreeNavNode[],
  findNode: (tree: CategoryTreeNavNode[], slug: string) =>
    findNode(tree as unknown as NavNode[], slug) as unknown as CategoryTreeNavNode | undefined,
});
