/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <CategoryTreeNav category="..." />.
//
// Data-resolution steps performed before forwarding to the v2 CategoryTreeNav component:
//   1. Load docs for the active locale (defaultLocale when not passed).
//   2. Build the full nav tree with buildNavTree() + groupSatelliteNodes()
//      (category slug is passed as the grouping prefix list).
//   3. Find the target category node via findNode().
//   4. Filter to children with hasPage === true or children.length > 0.
//   5. Forward the resolved children to the v2 CategoryTreeNav component.
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.

import type { JSX } from "preact";
import { CategoryTreeNav as CategoryTreeNavV2 } from "@takazudo/zudo-doc/nav-indexing";
import {
  buildNavTree,
  groupSatelliteNodes,
  findNode,
} from "@/utils/docs";
import { defaultLocale, type Locale } from "@/config/i18n";
import { resolveNavSource } from "./_nav-source-docs";

export interface CategoryTreeNavWrapperProps {
  /**
   * Slug of the category whose children should be rendered as a tree,
   * e.g. "guides" or "getting-started".
   */
  category: string;
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: Locale | string;
}

/**
 * MDX wrapper for CategoryTreeNav. Resolves nav tree data host-side and
 * forwards the resolved category children into the v2 CategoryTreeNav
 * component.
 *
 * Returns null when the category is not found or has no renderable children —
 * matching the original Astro component's guard.
 */
export function CategoryTreeNavWrapper({
  category,
  lang = defaultLocale,
}: CategoryTreeNavWrapperProps): JSX.Element | null {
  const locale = lang as Locale;

  // No defaultLocaleOnly filter — tree nav intentionally shows all EN pages
  // (same variant as _category-nav.tsx).
  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined, {
    keepUnlisted: true,
  });
  const rawTree = buildNavTree(navDocs, locale, categoryMeta);
  // groupSatelliteNodes with [category] groups satellite nodes under the
  // target category — matching the original Astro component.
  const tree = groupSatelliteNodes(rawTree, [category]);

  const categoryNode = findNode(tree, category);
  const children =
    categoryNode?.children.filter((c) => c.hasPage || c.children.length > 0) ??
    [];

  if (children.length === 0) return null;

  return <CategoryTreeNavV2 children={children} />;
}
