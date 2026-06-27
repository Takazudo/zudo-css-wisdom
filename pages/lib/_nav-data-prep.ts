// Host thin-stub for nav data-prep utilities (epic #2344, S5).
// Imports core logic from @takazudo/zudo-doc and wires host singletons.
//
// Package exports the pure parameterized functions; this stub binds
// them to the host's `settings`, `i18n`, and `base` singletons so
// existing call sites (_header-with-defaults.tsx, _sidebar-with-defaults.tsx)
// are unchanged.

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
import {
  remapVersionedHrefs as _remapVersionedHrefs,
  buildRootMenuItems as _buildRootMenuItems,
  buildLocaleLinksForNav as _buildLocaleLinksForNav,
  getThemeDefaultMode as _getThemeDefaultMode,
} from "@takazudo/zudo-doc/nav-data-prep";

// ---------------------------------------------------------------------------
// remapVersionedHrefs
// ---------------------------------------------------------------------------

/**
 * Walk the nav tree and rewrite each node's `href` to its versioned form.
 */
export function remapVersionedHrefs(
  nodes: NavNode[],
  version: string,
  nodeLang: Locale,
): NavNode[] {
  return _remapVersionedHrefs(
    nodes,
    version,
    nodeLang,
    (slug, v, lang) => versionedDocsUrl(slug, v, lang as Locale),
  );
}

// ---------------------------------------------------------------------------
// buildRootMenuItems
// ---------------------------------------------------------------------------

/**
 * Root-menu items derived from settings.headerNav (mobile "back to menu" list).
 */
export function buildRootMenuItems(
  lang: Locale,
  currentVersion?: string,
) {
  return _buildRootMenuItems(
    lang,
    currentVersion,
    settings.headerNav,
    (key, l) => t(key as Parameters<typeof t>[0], l as Locale),
    (path, l, v) => navHref(path, l as Locale | undefined, v),
  );
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
  return _buildLocaleLinksForNav(
    currentPath,
    lang,
    localeCount,
    (path, l) => buildLocaleLinks(path, l as Locale),
  );
}

// ---------------------------------------------------------------------------
// buildSidebarNodes
// ---------------------------------------------------------------------------

/**
 * Build the resolved sidebar node list for a given section + version.
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
  return _getThemeDefaultMode(settings.colorMode);
}
