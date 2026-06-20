// Shared nav data-prep utilities used by both _header-with-defaults.tsx
// and _sidebar-with-defaults.tsx.
//
// Extracted to avoid maintaining four near-identical copies: the two host
// modules above plus their template mirrors under
// packages/create-zudo-doc/templates/base/pages/lib/.

import { settings } from "@/config/settings";
import { t, type Locale } from "@/config/i18n";
import {
  buildLocaleLinks,
  navHref,
  versionedDocsUrl,
} from "@/utils/base";
import { type NavNode } from "@/utils/docs";
import { buildSidebarForSection } from "@/utils/sidebar";
import { loadNavSourceDocs } from "./_nav-source-docs";

// ---------------------------------------------------------------------------
// remapVersionedHrefs
// ---------------------------------------------------------------------------

/**
 * Walk the nav tree and rewrite each node's `href` to its versioned form.
 *
 * `buildNavTree` always emits hrefs via `docsUrl()`; when the active route
 * lives under `/v/{version}/...` we need the same nodes pointing at the
 * versioned URL so internal nav clicks stay inside the version. Skips
 * nodes without an href (link-only or category placeholders).
 */
export function remapVersionedHrefs(
  nodes: NavNode[],
  version: string,
  nodeLang: Locale,
): NavNode[] {
  return nodes.map((node) => {
    const children =
      node.children.length > 0
        ? remapVersionedHrefs(node.children, version, nodeLang)
        : node.children;

    if (!node.href || node.slug.startsWith("__link__")) {
      return children !== node.children ? { ...node, children } : node;
    }

    const newHref = versionedDocsUrl(node.slug, version, nodeLang);
    return { ...node, href: newHref, children };
  });
}

// ---------------------------------------------------------------------------
// buildRootMenuItems
// ---------------------------------------------------------------------------

/**
 * Root-menu items derived from settings.headerNav (mobile "back to menu" list).
 *
 * Used by both header and sidebar wrappers — the same nav data feeds both the
 * mobile SidebarToggle (header) and the desktop SidebarTree (sidebar).
 */
export function buildRootMenuItems(
  lang: Locale,
  currentVersion?: string,
) {
  return settings.headerNav.map((item) => ({
    label: item.labelKey
      ? t(item.labelKey as Parameters<typeof t>[0], lang)
      : item.label,
    href: navHref(item.path, lang, currentVersion),
    children: item.children?.map((child) => ({
      label: child.labelKey
        ? t(child.labelKey as Parameters<typeof t>[0], lang)
        : child.label,
      href: navHref(child.path, lang, currentVersion),
    })),
  }));
}

// ---------------------------------------------------------------------------
// buildLocaleLinksForNav
// ---------------------------------------------------------------------------

/**
 * Locale-switcher links for the mobile sidebar footer and language switcher.
 * Returns `undefined` when only one locale is configured (single-locale guard).
 */
export function buildLocaleLinksForNav(
  currentPath: string,
  lang: Locale,
  localeCount: number,
) {
  return localeCount > 1 ? buildLocaleLinks(currentPath, lang) : undefined;
}

// ---------------------------------------------------------------------------
// buildSidebarNodes
// ---------------------------------------------------------------------------

/**
 * Build the resolved sidebar node list for a given section + version.
 *
 * Loads the nav source, filters to the active section, then optionally
 * remaps hrefs for versioned routes.
 *
 * `emptyWhenUnsectioned` controls the `navSection === undefined` case —
 * the two legacy call sites deliberately disagreed: the header's mobile
 * drawer returned `[]` (root menu only), while the desktop sidebar fell
 * through to `buildSidebarForSection(..., undefined)` = the FULL tree
 * (pages whose slug matches no headerNav categoryMatch still get a
 * sidebar). Collapsing both to `[]` shipped an empty desktop sidebar for
 * unsectioned pages — keep the divergence explicit here.
 */
export function buildSidebarNodes(
  lang: Locale,
  navSection: string | undefined,
  currentVersion?: string,
  emptyWhenUnsectioned = true,
): NavNode[] {
  if (navSection === undefined && emptyWhenUnsectioned) return [];
  const { navDocs, categoryMeta } = loadNavSourceDocs(lang, currentVersion);
  const rawNodes = buildSidebarForSection(navDocs, lang, navSection, categoryMeta);
  return currentVersion
    ? remapVersionedHrefs(rawNodes, currentVersion, lang)
    : rawNodes;
}

// ---------------------------------------------------------------------------
// themeDefaultMode
// ---------------------------------------------------------------------------

/**
 * Extract the configured default color mode from settings.
 * Returns `undefined` when color mode is not configured (single-scheme projects).
 */
export function getThemeDefaultMode() {
  return settings.colorMode ? settings.colorMode.defaultMode : undefined;
}
