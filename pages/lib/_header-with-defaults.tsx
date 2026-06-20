/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-/version-aware Header wrapper for the zfb doc pages.
//
// Header data-prep utilities — builds the resolved header config from user
// settings + page context: header nav, active-path state, mobile SidebarToggle
// island (hamburger + slide-in panel) with the full sidebar tree for doc routes,
// and feeds everything into the v2 <Header> shell.
//
// Why this wrapper exists: the v2 Header shell is intentionally
// framework-agnostic — it accepts slot props (sidebarToggle, themeToggle,
// etc.) but does not import host helpers (@/config/*, @/utils/*) so the
// package can be published independently. The data prep stays on the host
// side. Without this wrapper the zfb doc pages fall through to the
// DocLayoutWithDefaults minimal default (a bare <header> with only
// <ThemeToggle>) — the full logo + nav + mobile-sidebar markup is absent
// from the SSG output, breaking crawlers, screen readers, and no-JS users.
//
// Mobile sidebar strategy:
//   - The v2 <Header> accepts a `sidebarToggle` slot that holds the
//     complete mobile sidebar widget: hamburger button + backdrop overlay +
//     slide-in <aside> panel (all rendered by <SidebarToggle>).
//   - This wrapper ALWAYS builds the sidebarToggle (refs #1453:
//     SidebarToggle is rendered unconditionally on every page; the host CSS
//     hides it on pages with hide_sidebar). When `navSection` is defined the
//     panel gets the full section tree; when undefined (home, 404, tags,
//     versions) nodes=[] so the panel shows only rootMenuItems.
//   - The bare package ThemeToggle (wrapped in Island below) is always passed
//     to Header.themeToggle so the ThemeToggle island marker appears in the
//     header on every page — matching the documented header contract.
//
// Locale switcher strategy (refs #1453):
//   - This wrapper always renders <LanguageSwitcher /> in the right-items row
//     when multiple locales are configured. Builds locale links from
//     buildLocaleLinks() and passes a <LanguageSwitcher> as the
//     languageSwitcher slot prop.
//   - Header only renders the slot when settings.locales has > 1 entry, so
//     single-locale projects are unaffected.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { Header } from "@takazudo/zudo-doc/header";
import {
  LanguageSwitcher,
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "@takazudo/zudo-doc/i18n-version";
// The bare (non-island-wrapped) package ThemeToggle, imported straight from
// the npm subpath: zfb >= 0.1.0-next.39 scans "use client" modules under
// node_modules (zfb#999/#1001), so the marker registers without the former
// project-source shim (#2048/#2057). This header composes its own Island
// below, avoiding nesting an island inside an island.
import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle";
import SidebarToggle from "@/components/sidebar-toggle";
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
import { filterHeaderRightItems } from "@takazudo/zudo-doc/header";
import { SearchWidget } from "./_search-widget";
import {
  buildRootMenuItems,
  buildLocaleLinksForNav,
  buildSidebarNodes,
  getThemeDefaultMode,
} from "./_nav-data-prep";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface HeaderWithDefaultsProps {
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: Locale | string;
  /**
   * Current page URL path (as the layout passes from Astro.url.pathname or
   * the zfb equivalent). Used by the Header to compute the active nav item
   * and by the mobile sidebar footer locale-switcher links.
   */
  currentPath?: string;
  /** Active version slug, when rendering inside /v/{version}/... routes. */
  currentVersion?: string;
  /**
   * Slug of the active doc page — forwarded to SidebarTree so it can
   * highlight the current entry. Required when navSection is set.
   */
  currentSlug?: string;
  /**
   * Header-nav category matcher used to scope the sidebar tree (e.g.
   * "guides"). When provided the mobile sidebar toggle is wired with the
   * full sidebar tree for this section. When omitted (404, index, tags,
   * versions pages) no mobile sidebar toggle is included in the header.
   */
  navSection?: string;
}

/**
 * Default-bearing host wrapper around v2's <Header> shell.
 *
 * Handles:
 *  1. Logo, main nav with active-path highlight — delegated to <Header>.
 *  2. ThemeToggle island in the right items row — passed as themeToggle slot.
 *  3. Mobile SidebarToggle island (hamburger + slide-in aside + tree) —
 *     built from the same nav data as SidebarWithDefaults and passed as
 *     the sidebarToggle slot when navSection is defined.
 */
export function HeaderWithDefaults(
  props: HeaderWithDefaultsProps,
): JSX.Element {
  const {
    lang: langProp = defaultLocale,
    currentPath = "",
    currentVersion,
    currentSlug,
    navSection,
  } = props;
  // Route params arrive as `string`; cast to Locale since keys of settings.locales
  // are always valid locale codes. The prop accepts `Locale | string` so callers
  // without a Locale variable don't need to cast (e.g. _tag-pages.tsx).
  const lang = langProp as Locale;

  // Root-menu items, locale links, sidebar nodes, and theme mode — all
  // delegated to the shared _nav-data-prep helpers so header and sidebar
  // wrappers stay in sync without duplicating the logic.
  const rootMenuItems = buildRootMenuItems(lang, currentVersion);

  // Build the mobile sidebar toggle unconditionally — SidebarToggle is rendered
  // on every page (refs #1453); the host CSS hides it where unneeded. When navSection is
  // defined the panel gets the full section tree; when undefined (home, 404,
  // tags, versions) nodes=[] so the panel shows only rootMenuItems + locale
  // links (the basic nav menu without a doc tree).
  const backToMenuLabel = t("nav.backToMenu", lang);

  // Locale-switcher links in the mobile sidebar footer — only when
  // multiple locales are configured (mirrors _sidebar-with-defaults.tsx).
  const localeLinks = buildLocaleLinksForNav(currentPath, lang, locales.length);

  const themeDefaultMode = getThemeDefaultMode();

  const sidebarNodes = buildSidebarNodes(lang, navSection, currentVersion);

  // Wrap SidebarToggle (hamburger button + slide-in aside + SidebarTree) in
  // Island so the SSG output carries the full tree HTML AND the
  // data-zfb-island="SidebarToggle" marker for client-side hydration.
  // Island.captureComponentName reads SidebarToggle.name → "SidebarToggle".
  //
  // SidebarTree's data props (nodes, currentSlug, rootMenuItems, …) are
  // passed to SidebarToggle directly rather than as JSX children so they
  // ride across the SSR → hydrate boundary in the Island marker's
  // `data-props` attribute. Island only serialises a wrapped child
  // component's *own* props (excluding `children`); when SidebarTree was
  // nested as a JSX child its data was dropped during hydration and
  // SidebarToggle re-rendered with `children=undefined`, wiping the SSR
  // tree DOM. zudolab/zudo-doc#1355 wave 13.5.
  //
  // C4 — media-gated hydration.  zfb only supports load|idle|visible
  // strategies (no "media" strategy; matchMedia inside the component is too
  // late — props are already emitted, bundle already downloaded).
  // Upstream feature request: Takazudo/zudo-front-builder#969.
  //
  // Best achievable downstream: when="visible" + all SidebarToggle children
  // are lg:hidden, so on desktop the Island wrapper div has zero rendered
  // dimensions.  IntersectionObserver fires isIntersecting=false on desktop
  // (zero-size element) → Preact hydrate() is never called.  On mobile (and
  // on desktop→mobile resize) the children become visible, the element gains
  // size, IO fires isIntersecting=true, and hydration completes normally.
  //
  // Residual: data-props JSON (~2.4 KB) is still emitted in the SSR HTML on
  // every page regardless of viewport, because it is serialised at build time
  // and not gated by media. Eliminating it requires a zfb "media" hydration
  // strategy — tracked in Takazudo/zudo-front-builder#969.
  const sidebarToggle = Island({
    when: "visible",
    children: (
      <SidebarToggle
        nodes={sidebarNodes}
        currentSlug={currentSlug}
        rootMenuItems={rootMenuItems}
        backToMenuLabel={backToMenuLabel}
        localeLinks={localeLinks}
        themeDefaultMode={themeDefaultMode}
      />
    ),
  }) as unknown as VNode;

  // Wrap the bare ThemeToggle in Island({when:"load"}) so the SSG
  // output emits a data-zfb-island="ThemeToggle" marker the hydration
  // runtime can find — matching the documented header contract.
  const themeToggle = Island({
    when: "load",
    children: <ThemeToggle defaultMode={themeDefaultMode} />,
  }) as unknown as VNode;

  // Locale-aware search widget. Renders the full dialog markup in SSR
  // so the placeholder text ("Type to search..." / 「検索したい単語を入力」)
  // and keyboard-shortcut hint appear in the static HTML on every page.
  // Strings are derived from the host's t() helper so locale switching works.
  const searchWidget = (
    <SearchWidget
      placeholderText={t("search.placeholder", lang)}
      shortcutHint={t("search.shortcutHint", lang)}
      resultCountTemplate={t("search.resultCount", lang)}
      searchLabel={t("search.label", lang)}
    />
  );

  // Build the version-switcher component when versioning is configured.
  // The VersionSwitcher is a pure SSR component — it emits the full dropdown
  // markup (including the "All versions" footer link) directly in the SSG
  // HTML so crawlers and JS-off users see the version list. The interactive
  // toggle behavior is wired by VERSION_SWITCHER_INIT_SCRIPT included in
  // the layout's body-end scripts.
  //
  // Gate: only render when settings.versions is a non-empty array. When
  // versioning is disabled (settings.versions === false) the slot is
  // undefined and the Header renders nothing for the version-switcher item.
  let versionSwitcher: VNode | undefined;

  if (settings.versions && settings.versions.length > 0) {
    const isNonDefaultLocale = lang !== defaultLocale;
    // "All versions" page URL — locale-prefixed when not on the default locale.
    const versionsPageUrl = withBase(
      isNonDefaultLocale ? `/${lang}/docs/versions` : "/docs/versions",
    );
    // "Latest" entry links to the current page in the latest (unversioned)
    // docs when a slug is available, or falls back to the versions index page.
    // Null check, not truthiness: "" is the canonical root-index slug (#1891)
    // and must produce real per-version root URLs.
    const latestUrl = currentSlug != null
      ? docsUrl(currentSlug, lang)
      : versionsPageUrl;

    // Per-version URLs for the current page. When there is no slug in scope
    // (e.g. on the versions page itself) all entries point to the versions
    // index — matching the documented version-switcher contract.
    const versionUrls: Record<string, string> = {};
    for (const v of settings.versions) {
      versionUrls[v.slug] = currentSlug != null
        ? versionedDocsUrl(currentSlug, v.slug, lang)
        : versionsPageUrl;
    }

    const labels: VersionSwitcherLabels = {
      latest: t("version.latest", lang),
      switcher: t("version.switcher.label", lang),
      unavailable: t("version.switcher.unavailable", lang),
      allVersions: t("version.switcher.allVersions", lang),
    };

    versionSwitcher = (
      <VersionSwitcher
        versions={settings.versions.map((v) => ({
          slug: v.slug,
          label: v.label ?? v.slug,
        }))}
        currentVersion={currentVersion}
        latestUrl={latestUrl}
        versionsPageUrl={versionsPageUrl}
        versionUrls={versionUrls}
        labels={labels}
        idSuffix="header"
      />
    ) as unknown as VNode;
  }

  // Build locale-switcher for the header right-items row (refs #1453).
  // Renders <LanguageSwitcher /> when multiple locales are configured.
  // Reuses the same localeLinks array built above for the mobile sidebar footer
  // (buildLocaleLinks is pure, but one call is cleaner).
  const languageSwitcher =
    localeLinks != null ? (
      <LanguageSwitcher
        links={localeLinks}
      />
    ) as unknown as VNode : undefined;

  // Locale-keyed persist key: same-locale swaps preserve the header's
  // DOM-node identity; cross-locale swaps use a different key and the
  // router replaces the header entirely (re-rendering locale-specific
  // SSR content such as the LanguageSwitcher anchors). See #1546 + #1549.
  const persistKey = `header-${lang}`;

  // Compute the right-items flags from the host's settings. The v2
  // `<Header>` no longer consults `@/config/settings` directly — see
  // sub-issue #1729 — so the wrapper is responsible for translating
  // host state into the prop bag the renderer expects. Boolean
  // coercion mirrors the original filter predicates verbatim.
  const headerRightItems = filterHeaderRightItems(
    settings.headerRightItems ?? [],
    {
      designTokenPanel: Boolean(settings.designTokenPanel),
      aiAssistant: Boolean(settings.aiAssistant),
      colorMode: Boolean(settings.colorMode),
      hasLocales: Object.keys(settings.locales).length > 0,
      hasVersions: Boolean(settings.versions),
      hasGithubUrl: Boolean(settings.githubUrl),
    },
  );

  const githubRepoUrl = buildGitHubRepoUrl();
  const githubLabel = t("header.github", lang);

  return (
    <Header
      lang={lang}
      currentPath={currentPath}
      currentVersion={currentVersion}
      activeCategory={navSection}
      sidebarToggle={sidebarToggle}
      themeToggle={themeToggle}
      search={searchWidget}
      versionSwitcher={versionSwitcher}
      languageSwitcher={languageSwitcher}
      persistKey={persistKey}
      siteName={settings.siteName}
      headerNav={settings.headerNav}
      headerRightItems={headerRightItems}
      colorModeEnabled={Boolean(settings.colorMode)}
      hasLocales={locales.length > 1}
      hasVersions={Boolean(settings.versions)}
      githubRepoUrl={githubRepoUrl}
      githubLabel={githubLabel}
      urlHelpers={{
        withBase,
        stripBase,
        // `navHref` from `@/utils/base` types the lang param as the
        // host's literal-locale union; v2's `Locale` is `string`. Wrap
        // so strictFunctionTypes accepts the assignment without losing
        // the runtime call shape (sub-issue #1729 boundary widening).
        navHref: (path, l, v) => navHref(path, l as Locale | undefined, v),
      }}
      i18n={{
        defaultLocale,
        locales,
        t,
      }}
    />
  );
}
