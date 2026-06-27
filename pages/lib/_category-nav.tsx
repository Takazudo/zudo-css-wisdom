/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — category-nav moved to the package (epic #2344, S8).
// Calls `createCategoryNavWrapper(deps)` from @takazudo/zudo-doc/category-nav
// with host singletons injected, then re-exports the resulting component so
// all existing call sites continue to work unchanged.

import { createCategoryNavWrapper } from "@takazudo/zudo-doc/category-nav";
import { buildNavTree, findNode, firstRoutedHref } from "@/utils/docs";
import { defaultLocale } from "@/config/i18n";
import { resolveNavSource } from "./_nav-source-docs";

export type { CategoryNavWrapperProps } from "@takazudo/zudo-doc/category-nav";

export const CategoryNavWrapper = createCategoryNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => import("@takazudo/zudo-doc/category-nav").CategoryNavSource,
  buildNavTree: buildNavTree as (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => import("@takazudo/zudo-doc/category-nav").CategoryNavNode[],
  findNode: findNode as (
    tree: import("@takazudo/zudo-doc/category-nav").CategoryNavNode[],
    slug: string,
  ) => import("@takazudo/zudo-doc/category-nav").CategoryNavNode | undefined,
  firstRoutedHref: firstRoutedHref as (
    node: import("@takazudo/zudo-doc/category-nav").CategoryNavNode,
  ) => string | undefined,
});
