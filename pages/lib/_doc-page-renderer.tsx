/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared page renderer for the 4 doc catch-all routes.
//
// Extracted (#2010) from the near-identical default components of:
//   pages/docs/[[...slug]].tsx
//   pages/[locale]/docs/[[...slug]].tsx
//   pages/v/[version]/docs/[[...slug]].tsx
//   pages/v/[version]/[locale]/docs/[[...slug]].tsx
//
// Each route's default export stays a thin adapter that reads its params /
// route-specific props (locale, version, contentDir, isFallback) and
// delegates here. Route-specific behavior is parameterized:
//   - `version` present → versioned chrome: versioned canonical URL, version
//     banner, version-aware switcher, auto-index child hrefs kept as the
//     pre-remapped versioned hrefs from paths() (#1916 #2), and doc history
//     hidden until versioned history is supported (#1916 #5).
//   - `version` absent → latest chrome: docsUrl canonical, child hrefs fall
//     back to the nav node's own docsUrl, doc history rendered for listed
//     entries via `docHistoryContentDir`.

import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { t, type Locale } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, absoluteUrl } from "@/utils/base";
import type { NavNode } from "@/utils/docs";
import { getNavSectionForSlug } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import type { JSX } from "preact";
// Shared MDX-tag → Preact-component bag. Includes htmlOverrides
// (native typography), HtmlPreviewWrapper (Island), and stub bindings
// for every other custom tag the MDX corpus references — see
// `pages/_mdx-components.ts` for the full list and rationale.
import { createMdxComponents } from "../_mdx-components";
import type { DocPageBaseProps } from "./doc-page-props";
import { DocHistoryArea } from "./_doc-history-area";
import { DocMetainfoArea } from "./_doc-metainfo-area";
import { buildInlineVersionSwitcher } from "./_inline-version-switcher";
import { DocContentHeader } from "./_doc-content-header";
import { DocPageShell } from "./_doc-page-shell";

export interface RenderDocPageOptions {
  /** Active locale — drives nav wrappers, labels, and URL building. */
  locale: Locale;
  /** Version config when rendering a versioned route; undefined = latest. */
  version?: VersionConfig;
  /** True when this page falls back to the base EN collection (locale
   *  routes). Drives the fallback notice + history-area hint. */
  isFallback?: boolean;
  /**
   * Content directory for the doc-history view-source link (e.g. the active
   * locale's dir, or the base docsDir for EN/fallback pages). Latest routes
   * pass it; versioned routes omit it — doc history is hidden on versioned
   * pages regardless (#1916 #5).
   */
  docHistoryContentDir?: string;
}

export function renderDocPage(
  props: DocPageBaseProps,
  opts: RenderDocPageOptions,
): JSX.Element {
  const { breadcrumbs, prev, next, headings } = props;
  const { locale, version, isFallback } = opts;

  const slug = props.kind === "autoIndex"
    ? props.autoIndex.slug
    : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

  const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
  const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  // Resolve child hrefs for auto-index pages. Versioned routes: child cards
  // already carry versioned hrefs from paths() (#1916 #2) — just filter to
  // renderable nodes. Latest routes: keep the nav node's own docsUrl href
  // (fallback for a noPage parent without an href).
  const autoIndexChildren = props.kind === "autoIndex"
    ? version
      ? props.autoIndex.children.filter((c: NavNode) => c.hasPage || c.children.length > 0)
      : props.autoIndex.children
          .filter((c: NavNode) => c.hasPage || c.children.length > 0)
          .map((c: NavNode) => ({
            ...c,
            href: c.href ?? docsUrl(c.slug, locale),
          }))
    : [];

  // Version banner: drives the `<VersionBanner>` element inside
  // DocLayoutWithDefaults when `version.banner` is "unmaintained" or
  // "unreleased". The banner links out to the latest version of the
  // current page (slug-preserving — strips the /v/{version}/ prefix,
  // keeps the /{locale}/ locale prefix).
  const versionBannerType = version?.banner ? version.banner : undefined;
  const versionBannerLatestUrl = versionBannerType
    ? docsUrl(slug, locale)
    : undefined;
  const versionBannerLabels = versionBannerType
    ? {
        message:
          versionBannerType === "unmaintained"
            ? t("version.banner.unmaintained", locale)
            : t("version.banner.unreleased", locale),
        latestLink: t("version.banner.latestLink", locale),
      }
    : undefined;

  // Canonical URL — base-prefixed page path, absolutized against siteUrl.
  // Versioned pages use the versioned URL as canonical.
  const currentPath = version
    ? versionedDocsUrl(slug, version.slug, locale)
    : docsUrl(slug, locale);
  const canonical = absoluteUrl(currentPath);

  // Persist key: locale + nav-section so the sidebar DOM node is reused
  // across same-locale + same-section navigations only. No sanitizer needed —
  // both lang (BCP-47 locale string) and navSection (filesystem-derived
  // kebab-case slug) come from controlled, trusted sources.
  const navSection = getNavSectionForSlug(slug);
  const hideSidebar = props.kind === "entry" ? props.entry.data.hide_sidebar : undefined;
  const sidebarPersistKey = hideSidebar
    ? undefined
    : `sidebar-${locale}-${navSection ?? "default"}`;

  return (
    <DocPageShell
      kind={props.kind}
      locale={locale}
      slug={slug}
      title={title}
      description={description}
      canonical={canonical}
      breadcrumbs={breadcrumbs}
      prev={prev}
      next={next}
      headings={headings}
      navSection={navSection}
      sidebarPersistKey={sidebarPersistKey}
      hideSidebar={hideSidebar}
      hideToc={props.kind === "entry" ? props.entry.data.hide_toc : undefined}
      currentPath={currentPath}
      currentVersion={version?.slug}
      versionSwitcher={buildInlineVersionSwitcher(slug, locale, version?.slug)}
      versionBanner={versionBannerType}
      versionBannerLatestUrl={versionBannerLatestUrl}
      versionBannerLabels={versionBannerLabels}
      autoIndexLabel={props.kind === "autoIndex" ? props.autoIndex.label : undefined}
      autoIndexChildren={autoIndexChildren}
      metainfoSlot={
        // Versioned gate mirrors DocContentHeader: the doc-history-meta
        // manifest is built from latest dirs only, so a bare versioned slug
        // would surface the LATEST page's Created/Updated/Author.
        !version && props.kind === "autoIndex" ? (
          <DocMetainfoArea slug={slug} locale={locale} isFallback={isFallback} />
        ) : null
      }
      contentHeaderSlot={
        props.kind === "entry" ? (
          <DocContentHeader
            entry={props.entry}
            slug={slug}
            locale={locale}
            isFallback={isFallback}
            version={version?.slug}
          />
        ) : undefined
      }
      contentSlot={
        props.kind === "entry" ? <props.entry.Content components={components} /> : undefined
      }
      docHistorySlot={
        // #1916 #5: doc-history hidden on versioned pages until versioned
        // history is supported.
        !version &&
        opts.docHistoryContentDir !== undefined &&
        props.kind === "entry" &&
        !props.entry.data.unlisted ? (
          <DocHistoryArea
            slug={slug}
            locale={locale}
            entrySlug={props.entry.slug}
            contentDir={opts.docHistoryContentDir}
            isFallback={isFallback}
          />
        ) : null
      }
    />
  );
}
