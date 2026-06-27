/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/header-with-defaults (epic #2344, S5).
import { settings } from "@/config/settings";
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import { buildGitHubRepoUrl } from "@/utils/github";
import {
  docsUrl,
  navHref,
  stripBase,
  versionedDocsUrl,
  withBase,
} from "@/utils/base";
import { createHeaderWithDefaults } from "@takazudo/zudo-doc/header-with-defaults";
import { SearchWidget } from "./_search-widget";
import {
  buildRootMenuItems,
  buildLocaleLinksForNav,
  buildSidebarNodes,
  getThemeDefaultMode,
} from "./_nav-data-prep";

export type { HeaderWithDefaultsProps } from "@takazudo/zudo-doc/header-with-defaults";

export const HeaderWithDefaults = createHeaderWithDefaults({
  settings,
  defaultLocale,
  locales,
  t: (key, lang) => t(key as Parameters<typeof t>[0], lang as Locale),
  withBase,
  stripBase,
  docsUrl: (slug, lang) => docsUrl(slug, lang as Locale),
  navHref: (path, lang, version) => navHref(path, lang as Locale | undefined, version),
  versionedDocsUrl: (slug, versionSlug, lang) =>
    versionedDocsUrl(slug, versionSlug, lang as Locale),
  buildLocaleLinksForNav: (currentPath, lang, localeCount) =>
    buildLocaleLinksForNav(currentPath, lang as Locale, localeCount),
  buildRootMenuItems: (lang, currentVersion) =>
    buildRootMenuItems(lang as Locale, currentVersion),
  buildSidebarNodes: (lang, navSection, currentVersion) =>
    buildSidebarNodes(lang as Locale, navSection, currentVersion),
  getThemeDefaultMode,
  buildGitHubRepoUrl,
  SearchWidget,
});
