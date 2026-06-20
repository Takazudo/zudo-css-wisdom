// Shared, memoized route-entry builder for the 4 doc catch-all routes.
//
// Extracted (#2010) from the ~85%-duplicated paths() bodies of:
//   pages/docs/[[...slug]].tsx
//   pages/[locale]/docs/[[...slug]].tsx
//   pages/v/[version]/docs/[[...slug]].tsx
//   pages/v/[version]/[locale]/docs/[[...slug]].tsx
//
// Each route resolves its own identity-stable nav source (resolveNavSource /
// resolveVersionedLocaleSource) and URL closure, then delegates the per-entry
// derived-data work here. The result is memoized with the #1902 WeakMap
// pattern (memoizeDerived keyed on the identity-stable `source.docs` array +
// a per-route signature), so the expensive per-entry work — extractHeadings,
// buildBreadcrumbs, prev/next resolution — runs ONCE per entry per build,
// not once per entry per page (zfb re-invokes paths() once per built page).
//
// Versioned-vs-latest behavior is keyed on the presence of `urlFor` (#1916):
//   - `urlFor` set (versioned routes): breadcrumbs resolve against the NAV
//     tree (unlisted excluded) with crumbs remapped to the versioned URL
//     space; prev/next hrefs are rewritten through the closure; auto-index
//     child-card hrefs are ALWAYS remapped to the versioned URL.
//   - `urlFor` unset (latest routes): breadcrumbs resolve against the FULL
//     tree (unlisted included, for accurate crumbs); prev/next and child
//     hrefs keep the latest `docsUrl` already baked into the nav nodes.
// These two behaviors travel together by construction: only versioned routes
// own a versioned URL closure (see _doc-route-paths.ts for the #1916
// rationale on why latest routes must never receive one).

import {
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
import type { Locale } from "@/config/i18n";
import { extractHeadings } from "./_extract-headings";
import type { AutoIndexNode, DocPageBaseProps } from "./doc-page-props";
import { memoizeDerived } from "./_nav-source-cache";
import type { NavSourceDocs } from "./_nav-source-docs";
import {
  resolveDocPrevNext,
  flattenSubtree,
  rewriteNavHref,
  remapNavChildHrefs,
} from "./_doc-route-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One enumerated doc route: a content entry or an auto-generated category
 *  index, with all per-page derived data pre-computed. */
export interface DocRouteEntry {
  /** Canonical route slug ("" for the docs root index — #1891). */
  slug: string;
  /** Optional-catchall params array — `toSlugParams(slug)` ([] for the root). */
  slugParams: string[];
  /**
   * True when the entry came from the base collection rather than the locale
   * collection (`!localeSlugSet.has(slug)`). Only meaningful on routes whose
   * nav source performs a locale merge — routes without one (default-locale /
   * versioned-EN, where `localeSlugSet` is empty) must ignore this field.
   * Always false for autoIndex items.
   */
  isFallback: boolean;
  /** Shared page props (kind/entry/autoIndex/breadcrumbs/prev/next/headings). */
  props: DocPageBaseProps;
}

export interface BuildDocRouteEntriesArgs {
  /** Identity-stable nav source for this route's (locale, version) context —
   *  from resolveNavSource / resolveVersionedLocaleSource. The memo is keyed
   *  on `source.docs` identity, so the source MUST come from those resolvers
   *  (a fresh array defeats the memo — harmless, but recomputes per call). */
  source: NavSourceDocs;
  /** Active locale for nav-tree labels and breadcrumbs. */
  locale: Locale;
  /**
   * Unique memo signature for this route context. Each route file passes its
   * own prefix plus the loop variables (version slug / locale), e.g.
   * "docs;en", "locale-docs;ja", "v-docs;1.0", "v-locale-docs;1.0;ja" —
   * call sites that share a docs array identity must never collide on a key.
   */
  routeSig: string;
  /** Versioned URL closure bound to the route's version (+ locale). Presence
   *  switches the versioned behaviors documented in the module header. */
  urlFor?: (slug: string) => string;
}

// ---------------------------------------------------------------------------
// buildDocRouteEntries
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc routes (content entries + auto-index pages) for one
 * (locale, version) context, with per-entry derived data pre-computed.
 *
 * Memoized per build on the identity-stable `source.docs` array (#1902), so
 * repeated paths() invocations across the route's many pages return the SAME
 * array instance without redoing the per-entry work. In the no-snapshot
 * fallback path (unit tests / direct Node runs) `source.docs` is a fresh
 * array per call, so the memo misses and this computes fresh — matching the
 * deliberate no-memo policy in _nav-source-cache.ts.
 */
export function buildDocRouteEntries(
  args: BuildDocRouteEntriesArgs,
): DocRouteEntry[] {
  const { source, locale, routeSig, urlFor } = args;

  return memoizeDerived([source.docs], `docRouteEntries;${routeSig}`, () => {
    const { docs, navDocs, categoryMeta, localeSlugSet } = source;

    // Nav docs: exclude unlisted (for sidebar/prev-next) but keep for breadcrumbs
    const tree = buildNavTree(navDocs, locale, categoryMeta);
    // Breadcrumb tree: latest routes use the full tree (including unlisted)
    // for accurate crumbs; versioned routes resolve crumbs against the nav
    // tree itself (#1916 #1).
    const breadcrumbTree = urlFor ? tree : buildNavTree(docs, locale, categoryMeta);

    const result: DocRouteEntry[] = [];

    // Regular doc pages
    for (const entry of docs) {
      // A `category_no_page` index.mdx carries category metadata only — keep
      // it in the nav tree (built above, used for breadcrumbs) but emit NO
      // route for it. zfb's walker retains every .mdx as a collection entry,
      // so without this explicit skip the metadata file would silently add a
      // route.
      if (entry.data.category_no_page === true) continue;
      // Canonical route slug via the one shared rule (@/utils/slug) — yields
      // "" for a root index (URL /docs/ — #1891).
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const navSection = getNavSectionForSlug(slug);
      const subtree = getNavSubtree(tree, navSection);

      // Prev/next + frontmatter pagination overrides resolved against THIS
      // route's own `tree`; versioned routes then rewrite the hrefs through
      // their urlFor closure (latest routes pass it through unchanged).
      const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
        tree,
        flattenSubtree(subtree),
        slug,
        entry.data,
      );

      result.push({
        slug,
        slugParams: toSlugParams(slug),
        isFallback: !localeSlugSet.has(slug),
        props: {
          kind: "entry",
          entry,
          breadcrumbs: buildBreadcrumbs(breadcrumbTree, slug, locale, urlFor),
          prev: rewriteNavHref(prevNode, urlFor),
          next: rewriteNavHref(nextNode, urlFor),
          headings: extractHeadings(entry.body ?? ""),
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        slug: node.slug,
        slugParams: toSlugParams(node.slug),
        isFallback: false,
        props: {
          kind: "autoIndex",
          autoIndex: urlFor
            ? // #1916 #2: child-card hrefs ALWAYS resolve to the versioned URL.
              ({
                ...node,
                children: remapNavChildHrefs(node.children, urlFor) as NavNode[],
              } as AutoIndexNode)
            : (node as AutoIndexNode),
          breadcrumbs: buildBreadcrumbs(breadcrumbTree, node.slug, locale, urlFor),
          prev: null,
          next: null,
          headings: [],
        },
      });
    }

    return result;
  });
}
