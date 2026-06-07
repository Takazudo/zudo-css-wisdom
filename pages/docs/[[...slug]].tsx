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

import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { docsUrl, absoluteUrl } from "@/utils/base";
import {
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
// Shared MDX-tag → Preact-component bag. Includes htmlOverrides
// (native typography), HtmlPreviewWrapper (Island), and stub bindings
// for every other custom tag the MDX corpus references — see
// `pages/_mdx-components.ts` for the full list and rationale.
import { createMdxComponents } from "../_mdx-components";
import { DocHistoryArea } from "../lib/_doc-history-area";
import { DocMetainfoArea } from "../lib/_doc-metainfo-area";
import { buildInlineVersionSwitcher } from "../lib/_inline-version-switcher";
import type { JSX } from "preact";
import { resolveNavSource } from "../lib/_nav-source-docs";
import { extractHeadings } from "../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../lib/doc-page-props";
import { DocContentHeader } from "../lib/_doc-content-header";
import { DocPageShell } from "../lib/_doc-page-shell";
import { resolveDocPrevNext, flattenSubtree } from "../lib/_doc-route-paths";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Props contract
// ---------------------------------------------------------------------------

// DocPageEntry, AutoIndexNode imported from pages/lib/doc-page-props.ts

type DocPageProps = DocPageEntryProps | DocPageAutoIndexProps;

// ---------------------------------------------------------------------------
// paths() — synchronous route enumeration (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc routes for the default locale (EN).
 *
 * Synchronous per ADR-004: getCollection() resolves from the pre-loaded
 * ContentSnapshot. All nav-tree and breadcrumb computation is done here
 * so the component is a pure renderer.
 */
export function paths(): Array<{
  params: { slug: string[] };
  props: DocPageProps;
}> {
  const locale = defaultLocale;
  // Identity-stable nav source (draft-filtered, unlisted retained). The same
  // instances are returned across this route's many per-page paths()
  // invocations, so buildNavTree's identity fast-path skips the key
  // recomputation — see pages/lib/_nav-source-docs.ts (#1902).
  const { docs, navDocs, categoryMeta } = resolveNavSource(locale, undefined);

  // Nav docs: exclude unlisted (for sidebar/prev-next) but keep for breadcrumbs
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  // Full tree (including unlisted) for accurate breadcrumbs
  const fullTree = buildNavTree(docs, locale, categoryMeta);

  const result: Array<{ params: { slug: string[] }; props: DocPageProps }> = [];

  // Regular doc pages
  for (const entry of docs) {
    const slug = entry.data.slug ?? toRouteSlug(entry.slug);
    const navSection = getNavSectionForSlug(slug);
    const subtree = getNavSubtree(tree, navSection);

    // Prev/next + frontmatter pagination overrides resolved against THIS
    // route's own `tree`. Latest route — hrefs stay unversioned (no rewrite).
    const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
      tree,
      flattenSubtree(subtree),
      slug,
      entry.data,
    );

    result.push({
      params: { slug: toSlugParams(slug) },
      props: {
        kind: "entry",
        entry,
        breadcrumbs: buildBreadcrumbs(fullTree, slug, locale),
        prev: prevNode,
        next: nextNode,
        headings: extractHeadings(entry.body ?? ""),
      },
    });
  }

  // Auto-generated index pages for categories without index.mdx
  for (const node of collectAutoIndexNodes(tree)) {
    result.push({
      params: { slug: toSlugParams(node.slug) },
      props: {
        kind: "autoIndex",
        autoIndex: node as AutoIndexNode,
        breadcrumbs: buildBreadcrumbs(fullTree, node.slug, locale),
        prev: null,
        next: null,
        headings: [],
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageArgs = DocPageProps & { params: { slug: string[] } };

export default function DocsPage(props: PageArgs): JSX.Element {
  const { breadcrumbs, prev, next, headings } = props;
  const locale = defaultLocale;

  const slug = props.kind === "autoIndex"
    ? props.autoIndex.slug
    : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

  const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
  const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  // Resolve child hrefs for auto-index pages — latest route keeps the nav
  // node's own docsUrl href (fallback for a noPage parent without an href).
  const autoIndexChildren = props.kind === "autoIndex"
    ? props.autoIndex.children
        .filter((c: NavNode) => c.hasPage || c.children.length > 0)
        .map((c: NavNode) => ({
          ...c,
          href: c.href ?? docsUrl(c.slug, locale),
        }))
    : [];

  // Canonical URL — base-prefixed page path, absolutized against siteUrl.
  const currentPath = docsUrl(slug, locale);
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
      versionSwitcher={buildInlineVersionSwitcher(slug, locale)}
      autoIndexLabel={props.kind === "autoIndex" ? props.autoIndex.label : undefined}
      autoIndexChildren={autoIndexChildren}
      metainfoSlot={
        props.kind === "autoIndex" ? <DocMetainfoArea slug={slug} locale={locale} /> : null
      }
      contentHeaderSlot={
        props.kind === "entry" ? (
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} />
        ) : undefined
      }
      contentSlot={
        props.kind === "entry" ? <props.entry.Content components={components} /> : undefined
      }
      docHistorySlot={
        props.kind === "entry" && !props.entry.data.unlisted ? (
          <DocHistoryArea
            slug={slug}
            locale={locale}
            entrySlug={props.entry.slug}
            contentDir={settings.docsDir}
          />
        ) : null
      }
    />
  );
}
