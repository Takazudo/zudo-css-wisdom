/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <SiteTreeNav /> and <SiteTreeNavDemo />.
//
// Both <SiteTreeNav> and <SiteTreeNavDemo> MDX tags are mapped to this
// wrapper, which loads the full site nav tree and renders the interactive
// SiteTreeNav island (refs #1453):
//
//   1. Load the full docs collection for the active locale.
//   2. Build nav tree via buildNavTree().
//   3. Group satellite nodes via groupSatelliteNodes().
//   4. Wrap the interactive SiteTreeNav in Island({when:"idle"}) so the MDX
//      page gets the collapsible grid rendered at
//      /docs/components/site-tree-nav/ (refs #1453/#1442).
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.
//
// categoryIgnore defaults to ["inbox", "develop"] — matching the index page
// and SiteTreeNavDemo defaults.

import type { JSX } from "preact";
import { Island } from "@takazudo/zfb";
import SiteTreeNav from "@/components/site-tree-nav";
import {
  buildNavTree,
  groupSatelliteNodes,
} from "@/utils/docs";
import { defaultLocale, type Locale } from "@/config/i18n";
import { getCategoryOrder } from "@/utils/nav-scope";
import { resolveNavSource } from "./_nav-source-docs";

export interface SiteTreeNavWrapperProps {
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: Locale | string;
  /**
   * Optional aria-label for the wrapping <nav> element.
   * Forwarded to the v2 SiteTreeNavDemo component.
   */
  ariaLabel?: string;
}

/**
 * MDX wrapper shared by both <SiteTreeNav> and <SiteTreeNavDemo> tags.
 *
 * Builds the full site nav tree and renders it via the interactive SiteTreeNav
 * island (wrapped in Island({when:"idle"})) — restoring byte-parity with the
 * Astro reference at /docs/components/site-tree-nav/ (refs #1453/#1442).
 *
 * The island renders the collapsible multi-column grid the reference shows.
 * SiteTreeNavDemo (static <details> list) is no longer used for MDX content.
 *
 * Returns null when the tree is empty after filtering.
 */
export function SiteTreeNavWrapper({
  lang = defaultLocale,
  ariaLabel,
}: SiteTreeNavWrapperProps): JSX.Element | null {
  const locale = lang as Locale;

  // SiteTreeNav mirrors the route nav: applies the defaultLocaleOnly filter for
  // non-default locales (same options the sidebar/route enumeration use).
  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined, {
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  if (groupedTree.length === 0) return null;

  return Island({
    when: "idle",
    children: (
      <SiteTreeNav
        tree={groupedTree}
        categoryOrder={categoryOrder}
        categoryIgnore={["inbox", "develop"]}
        ariaLabel={ariaLabel}
      />
    ),
  }) as unknown as JSX.Element;
}
