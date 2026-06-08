/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed docs route.
//
// Non-default-locale catch-all docs route. paths() emits one route per
// (locale, slug) combination — one locale from settings.locales per each
// doc in that locale's merged collection (locale-first + base fallback).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string; slug: string[] }
//   props:  { entry, autoIndex, contentDir, isFallback, breadcrumbs, prev, next }
//
// Route is the OPTIONAL catchall `[[...slug]]` so a locale root index.mdx can
// build at `/{locale}/docs/` (canonical root URL — #1891). The root entry
// emits `params.slug = []` via `toSlugParams`; a required `[...slug]` catchall
// rejects an empty array and would drop the ENTIRE locale route (the EN-root
// index leaks in via the locale-first EN fallback, so this fires even before a
// locale-specific root index exists — probe-observed page-count collapse).
//
// i18n / locale routing:
//   - Default locale (EN) is handled by pages/docs/[[...slug]].tsx
//     (prefixDefaultLocale: false).
//   - Non-default locales emit /{locale}/docs/{slug}.
//   - Locale-first merge: locale docs take priority; base EN docs fill in
//     pages not translated yet (shown with a fallback notice).

import { settings } from "@/config/settings";
import { docsUrl, absoluteUrl } from "@/utils/base";
import {
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
// Shared MDX components bag — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../_mdx-components";
import type { JSX } from "preact";
import { resolveNavSource } from "../../lib/_nav-source-docs";
import { extractHeadings } from "../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../lib/doc-page-props";
import { DocHistoryArea } from "../../lib/_doc-history-area";
import { DocMetainfoArea } from "../../lib/_doc-metainfo-area";
import { buildInlineVersionSwitcher } from "../../lib/_inline-version-switcher";
import { DocContentHeader } from "../../lib/_doc-content-header";
import { DocPageShell } from "../../lib/_doc-page-shell";
import { resolveDocPrevNext, flattenSubtree } from "../../lib/_doc-route-paths";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// DocPageEntry, AutoIndexNode imported from pages/lib/doc-page-props.ts

/** Route-specific extra fields — present on both branches of the union. */
interface LocaleDocPageExtra {
  /** Content directory for the active locale (or base EN for fallbacks). */
  contentDir: string;
  /** True when this page falls back to the base EN collection. */
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & LocaleDocPageExtra)
  | (DocPageAutoIndexProps & LocaleDocPageExtra);

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Emit one route per (non-default locale, slug) combination.
 *
 * Merge strategy:
 *   1. Load locale docs (e.g. "docs-ja").
 *   2. Load base EN docs ("docs").
 *   3. Locale docs take priority; base EN fills in slugs not translated.
 *   4. Track fallback slugs for the fallback-notice banner.
 *   5. Build nav tree, compute breadcrumbs and prev/next for each entry.
 *
 * Fallback slug set drives `isFallback` which the component uses to show
 * the "not yet translated" notice (matching the Astro original).
 */
export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: DocPageProps;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const locale of Object.keys(settings.locales) as string[]) {
    const localeConfig = settings.locales[locale];
    const contentDir = localeConfig?.dir ?? settings.docsDir;

    // Identity-stable, locale-first merge with EN fallback. The same `docs` /
    // `navDocs` / `categoryMeta` instances are reused across this route's many
    // per-page paths() invocations so buildNavTree's identity fast-path skips
    // the key recomputation — see pages/lib/_nav-source-docs.ts (#1902).
    const { docs: allDocs, navDocs, categoryMeta, localeSlugSet } = resolveNavSource(
      locale,
      undefined,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
    // isFallback: page came from base docs, not the locale collection.
    const fallbackSlugs = new Set(
      allDocs
        .filter((d) => !localeSlugSet.has(d.data.slug ?? d.id))
        .map((d) => d.data.slug ?? d.id),
    );

    const tree = buildNavTree(navDocs, locale, categoryMeta);
    const fullTree = buildNavTree(allDocs, locale, categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
      // A `category_no_page` index.mdx is metadata-only — kept in the nav tree
      // for breadcrumbs but emits no route (zfb retains every .mdx as a
      // collection entry, so the skip must be explicit).
      if (entry.data.category_no_page === true) continue;
      // Canonical route slug via the one shared rule (@/utils/slug). `entry.id`
      // is already `toRouteSlug(entry.slug)` (bridgeEntries → stripIndexSuffix →
      // toRouteSlug), so this is identical to the previous `entry.id` form for
      // every entry — but stating it explicitly removes the historical id-vs-
      // toRouteSlug asymmetry with the EN route and the component below, all of
      // which now yield "" for a root index (URL /{locale}/docs/ — #1891).
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const isFallback = fallbackSlugs.has(slug);
      const entryContentDir = isFallback ? settings.docsDir : contentDir;

      const navSection = getNavSectionForSlug(slug);
      const subtree = getNavSubtree(tree, navSection);

      // Prev/next + pagination overrides against THIS locale's own `tree`.
      // Latest content (no version) — hrefs stay unversioned (no rewrite).
      const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
        tree,
        flattenSubtree(subtree),
        slug,
        entry.data,
      );

      result.push({
        params: { locale, slug: toSlugParams(slug) },
        props: {
          kind: "entry",
          entry,
          contentDir: entryContentDir,
          isFallback,
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
        params: { locale, slug: toSlugParams(node.slug) },
        props: {
          kind: "autoIndex",
          autoIndex: node as AutoIndexNode,
          contentDir,
          isFallback: false,
          breadcrumbs: buildBreadcrumbs(fullTree, node.slug, locale),
          prev: null,
          next: null,
          headings: [],
        },
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageArgs = DocPageProps & { params: { locale: string; slug: string[] } };

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  const { breadcrumbs, prev, next, headings, contentDir, isFallback } = props;
  const locale = props.params.locale;

  const slug = props.kind === "autoIndex"
    ? props.autoIndex.slug
    : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

  const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
  const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  // Latest content (no version) — keep the nav node's own docsUrl href.
  const autoIndexChildren = props.kind === "autoIndex"
    ? props.autoIndex.children
        .filter((c: NavNode) => c.hasPage || c.children.length > 0)
        .map((c: NavNode) => ({
          ...c,
          href: c.href ?? docsUrl(c.slug, locale),
        }))
    : [];

  // Canonical URL — base-prefixed locale page path, absolutized against siteUrl.
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
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} isFallback={isFallback} />
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
            contentDir={contentDir}
            isFallback={isFallback}
          />
        ) : null
      }
    />
  );
}
