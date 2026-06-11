/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-/version-aware Sidebar wrapper for the zfb doc pages.
//
// Sidebar data-prep utilities — builds root-menu items from
// settings.headerNav, loads the locale's docs collection (with EN
// fallback for non-default locales), builds the nav tree for the active
// section, optionally remaps hrefs for versioned routes, and feeds the
// result into the host's <SidebarTree> Preact island.
//
// Why this wrapper exists: the data prep is host-only (it imports
// @/config/* and @/utils/*), so it cannot live in the published v2
// package. Without this wrapper the zfb doc pages fall through to a
// <SidebarTree nodes={[]} /> default and the SSG output emits an empty
// `<div data-zfb-island="SidebarTree" data-when="load"></div>` marker.

import type { JSX } from "preact";
// `<Island>` wraps `<SidebarTree>` directly here (rather than going through
// the v2 `<Sidebar>` shell with `treeComponent`) so the zfb island bundle's
// hydrate pass targets the actual stateful tree component. Mirrors the
// mobile `<SidebarToggle>` shape in `pages/lib/_header-with-defaults.tsx`:
// the hydration target owns its own data props directly so they ride the
// SSR → hydrate boundary inside the Island marker's `data-props` attribute.
//
// Background: zfb's `Island.captureSerializableProps` runs `JSON.stringify`
// on the wrapped component's own props bag, which silently drops function
// values. With the previous `<Sidebar treeComponent={SidebarTree} ...>`
// shape the `treeComponent` function was dropped during serialisation, so
// at hydration the v2 Sidebar shell mounted with `treeComponent=undefined`,
// returned `null`, and Preact's `hydrate(null, element)` left the SSR-
// rendered tree DOM in place WITHOUT attaching the input's `onChange`
// handler — typing into the filter input had no DOM effect.
// zudolab/zudo-doc#1459 (Wave 1 #1445 wired the input but not the wiring
// path; this wave routes the hydration target so the wiring actually
// reaches the rendered tree).
import { Island } from "@takazudo/zfb";
import SidebarTree from "@/components/sidebar-tree";
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import {
  buildRootMenuItems,
  buildLocaleLinksForNav,
  buildSidebarNodes,
  getThemeDefaultMode,
} from "./_nav-data-prep";

export interface SidebarWithDefaultsProps {
  /** Slug of the active doc page, used to highlight the current entry. */
  currentSlug?: string;
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: Locale;
  /** Header-nav category matcher used to scope the tree (e.g. "guides"). */
  navSection?: string;
  /** Active version slug, when rendering inside `/v/{version}/...`. */
  currentVersion?: string;
  /**
   * Current page URL path used to build the locale-switcher links shown in
   * the mobile sidebar footer. The Astro template read this from
   * `Astro.url.pathname`; in zfb the page module passes it explicitly.
   */
  currentPath?: string;
}

/**
 * Default-bearing host wrapper that performs sidebar data prep, then wraps
 * the project's `<SidebarTree>`
 * Preact island in `<Island when="load">` so the SSG output ships a
 * populated `<div data-zfb-island="SidebarTree" data-when="load">…tree…
 * </div>` marker for the hydration runtime to pick up.
 *
 * The v2 `<Sidebar>` shell is intentionally NOT used as the hydration
 * target here. Its `treeComponent` prop is a function, and zfb's
 * `Island.captureSerializableProps` drops function values during
 * `JSON.stringify`, so a `<Sidebar treeComponent={SidebarTree} ...>`
 * island would hydrate with `treeComponent=undefined` and the shell
 * would return `null`, silently breaking the filter input's hydration
 * (zudolab/zudo-doc#1459). Wrapping `<SidebarTree>` directly mirrors the
 * mobile `<SidebarToggle>` shape (see `_header-with-defaults.tsx`) and
 * keeps all data props serializable.
 */
export function SidebarWithDefaults(
  props: SidebarWithDefaultsProps,
): JSX.Element {
  const {
    currentSlug,
    lang = defaultLocale,
    navSection,
    currentVersion,
    currentPath = "",
  } = props;

  // Root-menu items, sidebar nodes, locale links, and theme mode — all
  // delegated to the shared _nav-data-prep helpers so header and sidebar
  // wrappers stay in sync without duplicating the logic.
  const rootMenuItems = buildRootMenuItems(lang, currentVersion);

  const backToMenuLabel = navSection ? t("nav.backToMenu", lang) : undefined;

  // emptyWhenUnsectioned=false: the desktop sidebar falls back to the FULL
  // tree for pages whose slug matches no headerNav categoryMatch (legacy
  // behavior) — only the header's mobile drawer collapses to root menu.
  const nodes = buildSidebarNodes(lang, navSection, currentVersion, false);

  // Locale-switcher links are only meaningful when more than one locale is
  // configured — matches the Astro template's guard.
  const localeLinks = buildLocaleLinksForNav(currentPath, lang, locales.length);

  // Wrap <SidebarTree> directly in <Island when="load">. SSR emits the
  // `data-zfb-island="SidebarTree"` marker around the rendered tree, with
  // all data props serialised into `data-props` (every prop is plain data:
  // arrays of objects + strings). At hydration the runtime finds the
  // marker, looks up "SidebarTree" in the islands manifest (registered via
  // the host's `"use client"` directive on `src/components/sidebar-tree.tsx`),
  // and mounts the real component in-place — re-attaching the filter
  // input's `onChange` handler to the existing SSR DOM.
  return Island({
    when: "load",
    children: (
      <SidebarTree
        nodes={nodes}
        currentSlug={currentSlug}
        rootMenuItems={rootMenuItems}
        backToMenuLabel={backToMenuLabel}
        localeLinks={localeLinks}
        themeDefaultMode={getThemeDefaultMode()}
      />
    ),
  }) as unknown as JSX.Element;
}
