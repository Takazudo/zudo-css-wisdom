/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the default-locale docs route.
//
// Default-locale (EN) catch-all docs route. paths() enumerates every page in
// the "docs" collection plus auto-generated category index pages (for
// categories without an index.mdx). Per-page props carry all pre-computed
// data so the component is a pure renderer with no collection reads.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { slug: string[] }   — e.g. ["getting-started", "intro"]
//   props:  { entry, autoIndex, breadcrumbs, prev, next }
//
// Route is the OPTIONAL catchall `[[...slug]]` so a bare root index.mdx can
// build at `/docs/` (canonical root URL — #1891). The root entry emits
// `params.slug = []` (zero segments) via `toSlugParams`; a required `[...slug]`
// catchall rejects an empty array and would drop the whole route.
//
// The catchall slug is an array per zfb spec — the component joins it when
// deriving the string form (e.g. for Content lookups, breadcrumbs, etc.).
//
// Locale: defaultLocale (EN). Non-default locales are handled by
// pages/[locale]/docs/[[...slug]].tsx.
//
// Enumeration + per-entry derived data (breadcrumbs, prev/next, headings) are
// built by the shared, memoized buildDocRouteEntries (#2010); rendering by the
// shared renderDocPage. This file owns only the route's nav source and the
// param/prop shapes.

import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import type { JSX } from "preact";
import { resolveNavSource } from "../lib/_nav-source-docs";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../lib/doc-page-props";
import { buildDocRouteEntries } from "../lib/_doc-route-entries";
import { renderDocPage } from "../lib/_doc-page-renderer";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Props contract
// ---------------------------------------------------------------------------

type DocPageProps = DocPageEntryProps | DocPageAutoIndexProps;

// ---------------------------------------------------------------------------
// paths() — synchronous route enumeration (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc routes for the default locale (EN).
 *
 * Synchronous per ADR-004: getCollection() resolves from the pre-loaded
 * ContentSnapshot. All nav-tree and breadcrumb computation is done in the
 * shared builder so the component is a pure renderer.
 */
export function paths(): Array<{
  params: { slug: string[] };
  props: DocPageProps;
}> {
  const locale = defaultLocale;
  // Identity-stable nav source (draft-filtered, unlisted retained). The same
  // instances are returned across this route's many per-page paths()
  // invocations, so both buildNavTree's identity fast-path and the
  // buildDocRouteEntries memo key on them — see pages/lib/_nav-source-docs.ts
  // (#1902).
  const source = resolveNavSource(locale, undefined);

  return buildDocRouteEntries({
    source,
    locale,
    routeSig: `docs;${locale}`,
  }).map((item) => ({
    params: { slug: item.slugParams },
    props: item.props,
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageArgs = DocPageProps & { params: { slug: string[] } };

export default function DocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: defaultLocale,
    docHistoryContentDir: settings.docsDir,
  });
}
