/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared render shell for all 4 doc-route page components.
//
// Extracted (#1917) from the near-verbatim render bodies of:
//   pages/docs/[[...slug]].tsx
//   pages/[locale]/docs/[[...slug]].tsx
//   pages/v/[version]/docs/[[...slug]].tsx
//   pages/v/[version]/[locale]/docs/[[...slug]].tsx
//
// This module is intentionally version- and i18n-AGNOSTIC: it imports no
// VersionConfig and no versionedDocsUrl. Everything version/locale-specific
// is threaded in as plain props or pre-built VNode slots, so the base EN
// route (which ships in every scaffold, including barebones) can depend on
// it without dragging in the versioning/i18n feature surface. The feature
// route templates import this same module via the identical relative path,
// keeping the create-zudo-doc template copies byte-identical to the host.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import type { NavNode } from "@/utils/docs";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { Toc, MobileToc } from "@takazudo/zudo-doc/toc";
import { getTocTitle } from "./_toc-title";
import { Breadcrumb } from "@takazudo/zudo-doc/breadcrumb";
import { NavCardGrid } from "@takazudo/zudo-doc/nav-indexing";
import { HeadWithDefaults } from "./_head-with-defaults";
import { composeMetaTitle } from "./_compose-meta-title";
import { SidebarWithDefaults } from "./_sidebar-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { SidebarPrepaint } from "./_sidebar-prepaint";
import { DocBodyEnd } from "./_doc-body-end";
import { DocPager } from "./_doc-pager";
import type { BreadcrumbItem } from "@/utils/docs";
import type { VersionBannerLabels } from "@takazudo/zudo-doc/i18n-version";
import type { Locale } from "@/config/i18n";
import type { extractHeadings } from "./_extract-headings";

/** Slots and parameters that vary between the 4 doc routes. */
export interface DocPageShellProps {
  /** Discriminates the body: a real entry vs an auto-generated category index. */
  kind: "entry" | "autoIndex";
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /** Canonical route slug for this page (no version/locale prefix). */
  slug: string;
  /** Page title (entry title or auto-index label). */
  title: string;
  /** Page description (may be undefined). */
  description?: string;
  /** Absolute canonical URL, or undefined when siteUrl is unset. */
  canonical?: string;
  /** Pre-resolved breadcrumb trail (hrefs already remapped per route). */
  breadcrumbs: BreadcrumbItem[];
  /** Pre-resolved prev/next nav nodes (hrefs already remapped per route). */
  prev: NavNode | null;
  next: NavNode | null;
  /** Depth-2/3/4 headings for the SSG TOC. */
  headings: ReturnType<typeof extractHeadings>;

  /** Sidebar/header nav-section key for this slug. */
  navSection: string | undefined;
  /** Per-page sidebar persist key (undefined when the sidebar is hidden). */
  sidebarPersistKey: string | undefined;
  /** Whether to hide the sidebar entirely (entry frontmatter). */
  hideSidebar?: boolean;
  /** Whether to hide the TOC (entry frontmatter). */
  hideToc?: boolean;

  /**
   * Path of THIS page used by Header/Sidebar to mark the active item.
   * Latest routes pass docsUrl(slug, locale); versioned routes pass
   * versionedDocsUrl(slug, version, locale).
   */
  currentPath: string;
  /** Version slug for Header/Sidebar active-state, or undefined on latest routes. */
  currentVersion?: string;
  /** Inline version switcher VNode for the breadcrumb right-slot (route-built). */
  versionSwitcher: ComponentChildren;

  /** Version banner type ("unmaintained" | "unreleased") or undefined on latest. */
  versionBanner?: "unmaintained" | "unreleased";
  /** URL of the latest equivalent page for the version banner link. */
  versionBannerLatestUrl?: string;
  /** Localized version-banner labels. */
  versionBannerLabels?: VersionBannerLabels;

  /** Auto-index branch: label heading text. */
  autoIndexLabel?: string;
  /** Auto-index branch: pre-filtered + href-remapped child cards. */
  autoIndexChildren?: NavNode[];

  /**
   * Auto-index branch slot: the build-time date block (DocMetainfoArea), or
   * null to omit it. Threaded in so the shell stays oblivious to which routes
   * render it.
   */
  metainfoSlot?: VNode | null;

  /**
   * Entry branch slot: the content header (h1 + meta + tags + description +
   * frontmatter preview), built per route (carries isFallback).
   */
  contentHeaderSlot?: VNode;
  /** Entry branch slot: the rendered MDX `<Content />`. */
  contentSlot?: VNode;
  /**
   * Entry branch slot: the document-utilities area (DocHistoryArea), or null
   * to omit it. Hidden on versioned pages (#1916 #5).
   */
  docHistorySlot?: VNode | null;
}

/**
 * Render shell shared by all 4 doc-route page components. The caller computes
 * every route-specific value (URLs, version switcher, slots) and passes it in;
 * this component only assembles the DocLayoutWithDefaults call and the two
 * body branches (auto-index vs entry).
 */
export function DocPageShell(props: DocPageShellProps): JSX.Element {
  const {
    kind,
    locale,
    title,
    description,
    canonical,
    breadcrumbs,
    prev,
    next,
    headings,
    navSection,
    sidebarPersistKey,
    hideSidebar,
    hideToc,
    currentPath,
    currentVersion,
    versionSwitcher,
    versionBanner,
    versionBannerLatestUrl,
    versionBannerLabels,
    autoIndexLabel,
    autoIndexChildren,
    metainfoSlot,
    contentHeaderSlot,
    contentSlot,
    docHistorySlot,
  } = props;

  // TOC overrides: mount the package Toc/MobileToc with the host-resolved
  // locale-aware `tocTitle`. The gating mirrors the package's
  // `shouldRenderDefaultToc` exactly (`!hideToc && headings.length > 0`) so an
  // undefined override never silently falls back to the package default with a
  // different title. Each is wrapped in `<Island when="load">` here (the call
  // site), matching how the package wraps its own default. Hydrating these
  // npm-dist "use client" components requires zfb >= 0.1.0-next.39, whose
  // scanner registers node_modules islands (zfb#999/#1001) — the former
  // scanner-visible local shims (#2057) are gone; re-adding them would
  // recreate island marker-name collisions.
  const tocTitle = getTocTitle(locale);
  const shouldRenderToc = !hideToc && headings.length > 0;
  const tocOverride = shouldRenderToc
    ? (Island({
        when: "load",
        children: <Toc headings={headings} title={tocTitle} />,
      }) as unknown as VNode)
    : undefined;
  const mobileTocOverride = shouldRenderToc
    ? (Island({
        when: "load",
        children: <MobileToc headings={headings} title={tocTitle} />,
      }) as unknown as VNode)
    : undefined;

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      // Plain <meta name="description"> is emitted by DocLayout from this prop —
      // gate it here alongside the og:description gate inside HeadWithDefaults (#2078)
      description={settings.metaTags.description ? description : undefined}
      head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={hideSidebar}
      hideToc={hideToc}
      headings={headings}
      canonical={canonical}
      sidebarPersistKey={sidebarPersistKey}
      versionBanner={versionBanner ?? false}
      versionBannerLatestUrl={versionBannerLatestUrl}
      versionBannerLabels={versionBannerLabels}
      headerOverride={
        <HeaderWithDefaults
          lang={locale as Locale}
          currentSlug={props.slug}
          navSection={navSection}
          currentVersion={currentVersion}
          currentPath={currentPath}
        />
      }
      breadcrumbOverride={
        breadcrumbs.length > 0 ? (
          <Breadcrumb items={breadcrumbs} rightSlot={versionSwitcher} />
        ) : undefined
      }
      sidebarOverride={
        <SidebarWithDefaults
          currentSlug={props.slug}
          lang={locale as Locale}
          navSection={navSection}
          currentVersion={currentVersion}
          currentPath={currentPath}
        />
      }
      tocOverride={tocOverride}
      mobileTocOverride={mobileTocOverride}
      afterSidebar={<SidebarPrepaint />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<DocBodyEnd />}
    >
      {kind === "autoIndex" ? (
        /* Auto-index page: category without an index.mdx.
           Fragment (not <div>) so children become direct children of
           <article class="zd-content">, picking up the flow-space rule
           (.zd-content > :where(* + *) { margin-top: var(--flow-space) }).
           Wrapping in <div> would make h1/description p children-of-children
           and the flow gap (~24px) would never apply — see #1460. */
        <>
          <h1 class="text-heading font-bold mb-vsp-xs">{autoIndexLabel}</h1>

          {/* Build-time date block — chrome parity (#1461). Threaded in via
              metainfoSlot so each route controls whether it renders. */}
          {metainfoSlot}

          {description && (
            <p class="mb-vsp-lg text-title text-muted">{description}</p>
          )}
          <NavCardGrid children={autoIndexChildren ?? []} />
        </>
      ) : (
        /* Regular doc page. Fragment (not <div>) for the same reason as
           the auto-index branch above — see #1460. */
        <>
          {contentHeaderSlot}

          {contentSlot}

          {/* Prev / Next pagination — placed before the document utilities
              section to match the Astro reference order: content → pager →
              view-source / history. Fixes #1535. */}
          <DocPager prev={prev} next={next} locale={locale} />

          {/* Document utilities (revision history + view-source link).
              Threaded in via docHistorySlot; null on versioned pages
              until versioned history is supported (#1916 #5). */}
          {docHistorySlot}
        </>
      )}
    </DocLayoutWithDefaults>
  );
}
