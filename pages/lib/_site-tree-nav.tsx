/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — site-tree-nav moved to the package (epic #2344, S8).
// Calls `createSiteTreeNavWrapper(deps)` from @takazudo/zudo-doc/site-tree-nav
// with host singletons injected, then re-exports the resulting component so
// all existing call sites continue to work unchanged.
//
// IMPORTANT: Island({when:"idle"}) is PRESERVED in the package factory —
// the island mounts after the page is idle for performance (refs #1453).

import { createSiteTreeNavWrapper } from "@takazudo/zudo-doc/site-tree-nav";
import type { SidebarNavNode } from "@takazudo/zudo-doc/sidebar/types";
import { buildNavTree, groupSatelliteNodes } from "@/utils/docs";
import { defaultLocale } from "@/config/i18n";
import { getCategoryOrder } from "@/utils/nav-scope";
import { resolveNavSource } from "./_nav-source-docs";

export type { SiteTreeNavWrapperProps } from "@takazudo/zudo-doc/site-tree-nav";

export const SiteTreeNavWrapper = createSiteTreeNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => import("@takazudo/zudo-doc/site-tree-nav").SiteTreeNavSource,
  buildNavTree: buildNavTree as (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => SidebarNavNode[],
  groupSatelliteNodes: groupSatelliteNodes as (
    tree: SidebarNavNode[],
    prefixes: string[],
  ) => SidebarNavNode[],
  getCategoryOrder,
});
