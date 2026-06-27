/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/sidebar-with-defaults (epic #2344, S5).
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import { createSidebarWithDefaults } from "@takazudo/zudo-doc/sidebar-with-defaults";
import {
  buildRootMenuItems,
  buildLocaleLinksForNav,
  buildSidebarNodes,
  getThemeDefaultMode,
} from "./_nav-data-prep";

export type { SidebarWithDefaultsProps } from "@takazudo/zudo-doc/sidebar-with-defaults";

export const SidebarWithDefaults = createSidebarWithDefaults({
  defaultLocale,
  localeCount: locales.length,
  buildRootMenuItems: (lang, currentVersion) =>
    buildRootMenuItems(lang as Locale, currentVersion),
  buildLocaleLinksForNav: (currentPath, lang, localeCount) =>
    buildLocaleLinksForNav(currentPath, lang as Locale, localeCount),
  buildSidebarNodes: (lang, navSection, currentVersion, emptyWhenUnsectioned) =>
    buildSidebarNodes(lang as Locale, navSection, currentVersion, emptyWhenUnsectioned),
  getThemeDefaultMode,
  t: (key, lang) => t(key as Parameters<typeof t>[0], lang as Locale),
});
