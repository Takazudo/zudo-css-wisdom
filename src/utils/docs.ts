import type { DocsEntry } from "@/types/docs-entry";
import { docsUrl, withBase } from "@/utils/base";
import { defaultLocale, type Locale } from "@/config/i18n";
import {
  buildSidebarTree,
  type CategoryMeta,
  type SidebarNode,
} from "@takazudo/zudo-doc/sidebar-tree";

/** Filter predicate: true when a doc should appear in navigation (sidebar, index, sitemap). */
export function isNavVisible(doc: DocsEntry): boolean {
  return !doc.data.unlisted && !doc.data.standalone;
}

// `_category_.json` loading + per-directory memoization live in the shared
// framework package — the host keeps no parallel copy (#2030 dedup). The
// package memoizes per resolved (absolute) contentDir, so the returned Map
// instance is stable per directory — which `stableMergeCategoryMeta` and the
// identity fast-path below rely on.
export { loadCategoryMeta } from "@takazudo/zudo-doc/sidebar-tree";
export type { CategoryMeta } from "@takazudo/zudo-doc/sidebar-tree";

export interface NavNode {
  slug: string;
  label: string;
  description?: string;
  position: number;
  href?: string;
  hasPage: boolean;
  children: NavNode[];
  sortOrder?: "asc" | "desc";
  collapsed?: boolean;
}

// Module-level cache — persists across all page renders during a single build.
//
// Bounded LRU, cap 64. A production build only ever needs a handful of
// distinct keys — one per (locale × version × categoryMeta-variant), single
// digits for this corpus — so 64 never evicts within one build. The cap
// exists for dev: every content edit under HMR produces a NEW content key
// (the key embeds nav-affecting frontmatter by design, so edits bust the
// cache), and before #2030 the Map grew unbounded across a long dev session,
// each entry holding an O(corpus) key string plus a full tree. With the cap,
// stale generations age out once 64 fresher keys land. (#1902's WeakMap
// identity fast-path keeps production hits off this Map entirely.)
const NAV_TREE_CACHE_MAX = 64;
const navTreeCache = new Map<string, NavNode[]>();

function navTreeCacheGet(key: string): NavNode[] | undefined {
  const hit = navTreeCache.get(key);
  if (hit !== undefined) {
    // Refresh recency — Map preserves insertion order, so delete+set moves
    // the entry to the "most recently used" end.
    navTreeCache.delete(key);
    navTreeCache.set(key, hit);
  }
  return hit;
}

function navTreeCacheSet(key: string, value: NavNode[]): void {
  navTreeCache.delete(key);
  navTreeCache.set(key, value);
  if (navTreeCache.size > NAV_TREE_CACHE_MAX) {
    const oldest = navTreeCache.keys().next().value;
    if (oldest !== undefined) navTreeCache.delete(oldest);
  }
}

// Identity fast-path cache. Keyed on the docs-array reference: when nav-source
// loaders hand back the SAME stable array instance across the build's many
// `buildNavTree` calls (route paths() re-invoked per page, per-page sidebar +
// header), this lets us skip recomputing the O(n log n) stringify+sort key
// entirely. Anchored per (lang, categoryMeta) since the same array can be
// rendered under different locales / category metadata.
//
// This is ADDITIVE: a miss falls through to `navTreeCacheKey` + `navTreeCache`,
// which still catches content-equal arrays that lack reference identity (e.g.
// any caller that hasn't been routed through the stable loaders). HMR intent
// is preserved because a content edit produces a new snapshot → new stable
// array identity → fresh entry here AND a different content key downstream.
const navTreeByIdentity = new WeakMap<
  DocsEntry[],
  Array<{ lang: Locale; categoryMeta: Map<string, CategoryMeta> | undefined; tree: NavNode[] }>
>();

/** Build a cache key from docs array + locale + category meta.
 *  Includes nav-affecting frontmatter so HMR picks up changes. */
function navTreeCacheKey(
  docs: DocsEntry[],
  lang: Locale,
  categoryMeta?: Map<string, CategoryMeta>,
): string {
  const metaKey = categoryMeta
    ? JSON.stringify([...categoryMeta.entries()].sort(([a], [b]) => a.localeCompare(b)))
    : "_";
  return `${lang}:${metaKey}:${docs
    .map((d) => {
      const {
        sidebar_position,
        sidebar_label,
        title,
        description,
        unlisted,
        standalone,
        slug,
        category_no_page,
        category_sort_order,
      } = d.data;
      return JSON.stringify([
        d.id,
        sidebar_position,
        sidebar_label,
        title,
        description,
        unlisted,
        standalone,
        slug,
        category_no_page,
        category_sort_order,
      ]);
    })
    .sort()
    .join(",")}`;
}

/**
 * Build a recursive navigation tree from a flat content collection.
 * Mirrors the filesystem: directories become category nodes, files become leaves.
 *
 * Since #2030 the tree construction itself is delegated to the shared
 * framework builder (`buildSidebarTree` in @takazudo/zudo-doc/sidebar-tree);
 * this function keeps the host-side concerns: the NavNode shape consumed by
 * every host nav surface, the content-key cache, and the identity fast-path.
 */
export function buildNavTree(
  docs: DocsEntry[],
  lang: Locale = defaultLocale,
  categoryMeta?: Map<string, CategoryMeta>,
): NavNode[] {
  // Identity fast-path: stable array instance already seen for this
  // (lang, categoryMeta)? Return its tree without recomputing the key.
  const byIdentity = navTreeByIdentity.get(docs);
  if (byIdentity) {
    for (const slot of byIdentity) {
      if (slot.lang === lang && slot.categoryMeta === categoryMeta) {
        return slot.tree;
      }
    }
  }

  const cacheKey = navTreeCacheKey(docs, lang, categoryMeta);
  const cached = navTreeCacheGet(cacheKey);
  if (cached) {
    rememberIdentity(docs, lang, categoryMeta, cached);
    return cached;
  }

  const sidebarTree = buildSidebarTree(
    // Pass `{ id, data }` only — NOT the whole entry. zfb entries carry the
    // raw, un-index-stripped engine slug on the top-level `slug` field
    // (e.g. "getting-started/index"), and the shared builder prefers
    // `entry.slug` over the id-derived form; forwarding it would mint wrong
    // node paths. Omitting it reproduces the legacy host derivation
    // `data.slug ?? toRouteSlug(id)` (ids arrive pre-stripped via _data.ts).
    docs.map((d) => ({ id: d.id, data: d.data })),
    lang,
    {
      categoryMeta,
      buildHref: (slug, locale) => docsUrl(slug, locale),
      // Host call sites own visibility: nav surfaces pre-filter via
      // `stableNavDocs(docs.filter(isNavVisible))`, while the breadcrumb tree
      // intentionally builds from the UNFILTERED list so unlisted pages still
      // get breadcrumbs. Disable the builder's default unlisted/standalone
      // filter so neither path changes behavior.
      isNavVisible: () => true,
    },
  );
  const result = sidebarTree.map(toNavNode);

  // Root docs-index entry (derived slug "" — a root index.mdx arrives from
  // _data.ts bridging as id ""). The shared builder drops empty slugs, but the
  // legacy host builder minted a top-level node keyed "" (href /docs/) so the
  // root page stayed present in sidebar/breadcrumb/prev-next data. Re-create
  // that node here with the exact legacy field derivation, then re-sort with
  // the same comparator the builder used (stable sort → idempotent for the
  // already-sorted rest).
  const rootDoc = findRootIndexDoc(docs);
  if (rootDoc) {
    result.push(toRootNavNode(rootDoc, lang, categoryMeta));
    result.sort((a, b) => {
      const posCompare = a.position - b.position;
      if (posCompare !== 0) return posCompare;
      return a.slug.localeCompare(b.slug);
    });
  }

  navTreeCacheSet(cacheKey, result);
  rememberIdentity(docs, lang, categoryMeta, result);
  return result;
}

/** Last entry whose package-derived slug is empty ("") — i.e. the entry the
 *  shared builder skips. Last one wins, mirroring the legacy builder's
 *  `node.doc = doc` overwrite. (A bare id "index" is NOT matched here: both
 *  the legacy and shared builders resolve it to a node keyed "index".) */
function findRootIndexDoc(docs: DocsEntry[]): DocsEntry | undefined {
  let found: DocsEntry | undefined;
  for (const d of docs) {
    const slug = d.data.slug ?? d.id.replace(/\/index$/, "");
    if (slug === "") found = d;
  }
  return found;
}

/** Legacy-faithful node for the root docs index (slug ""): no children are
 *  possible (a multi-segment slug never has an empty first part), label falls
 *  back through the same chain (title is required, so it always resolves),
 *  and href is the locale docs root. */
function toRootNavNode(
  doc: DocsEntry,
  lang: Locale,
  categoryMeta?: Map<string, CategoryMeta>,
): NavNode {
  const meta = categoryMeta?.get("");
  const noPage = doc.data.category_no_page ?? meta?.noPage;
  const sortOrder = doc.data.category_sort_order ?? meta?.sortOrder ?? "asc";
  return {
    slug: "",
    label: doc.data.sidebar_label ?? doc.data.title ?? meta?.label ?? "",
    description: doc.data.description ?? meta?.description,
    position: doc.data.sidebar_position ?? meta?.position ?? 999,
    href: noPage ? undefined : docsUrl("", lang),
    hasPage: noPage !== true,
    children: [],
    sortOrder,
  };
}

/** Map the shared builder's SidebarNode shape onto the host NavNode shape.
 *  `position` and `sortOrder` defaults mirror the legacy inline builder:
 *  position falls back to 999 (ties sort alphabetically) and sortOrder is
 *  always materialized ("asc" unless frontmatter/sidecar set it). */
function toNavNode(node: SidebarNode): NavNode {
  return {
    slug: node.id,
    label: node.label,
    description: node.description,
    position: node.sidebar_position ?? 999,
    href: node.href,
    hasPage: node.hasPage,
    children: node.children.map(toNavNode),
    sortOrder: node.sortOrder ?? "asc",
  };
}

/** Record a (docs-array identity, lang, categoryMeta) → tree mapping for the
 *  identity fast-path. No-op-safe to call multiple times for the same slot. */
function rememberIdentity(
  docs: DocsEntry[],
  lang: Locale,
  categoryMeta: Map<string, CategoryMeta> | undefined,
  tree: NavNode[],
): void {
  let slots = navTreeByIdentity.get(docs);
  if (!slots) {
    slots = [];
    navTreeByIdentity.set(docs, slots);
  }
  if (!slots.some((s) => s.lang === lang && s.categoryMeta === categoryMeta)) {
    slots.push({ lang, categoryMeta, tree });
  }
}

/**
 * Group "satellite" nodes under their primary node based on slug prefixes.
 * E.g. with prefix "claude", nodes "claude-md", "claude-commands" get moved
 * under the "claude" node as children.
 */
export function groupSatelliteNodes(tree: NavNode[], prefixes: string[]): NavNode[] {
  const result = [...tree];
  for (const prefix of prefixes) {
    const primaryIdx = result.findIndex((n) => n.slug === prefix);
    if (primaryIdx < 0) continue;
    const primary = result[primaryIdx];
    if (!primary) continue;
    const satelliteIdxs: number[] = [];
    for (let i = 0; i < result.length; i++) {
      const node = result[i];
      if (node && i !== primaryIdx && node.slug.startsWith(`${prefix}-`)) {
        satelliteIdxs.push(i);
      }
    }
    if (satelliteIdxs.length === 0) continue;
    const extraChildren: NavNode[] = [];
    for (const idx of satelliteIdxs) {
      const node = result[idx];
      if (node) extraChildren.push(node);
    }
    result[primaryIdx] = {
      ...primary,
      children: [...primary.children, ...extraChildren],
    };
    for (const idx of satelliteIdxs.reverse()) {
      result.splice(idx, 1);
    }
  }
  return result;
}

/** DFS flatten the tree for prev/next navigation. Only includes nodes with pages. */
export function flattenTree(nodes: NavNode[]): NavNode[] {
  const result: NavNode[] = [];
  flattenInto(nodes, result);
  return result;
}

function flattenInto(nodes: NavNode[], acc: NavNode[]): void {
  for (const node of nodes) {
    if (node.hasPage) {
      acc.push(node);
    }
    flattenInto(node.children, acc);
  }
}

/** Collect all category nodes that have children but no page (no index.mdx).
 *  Nodes without href (e.g. noPage categories) are skipped — they are toggle-only. */
export function collectAutoIndexNodes(nodes: NavNode[]): NavNode[] {
  const result: NavNode[] = [];
  for (const node of nodes) {
    if (!node.hasPage && node.children.length > 0 && node.href) {
      result.push(node);
    }
    result.push(...collectAutoIndexNodes(node.children));
  }
  return result;
}

/** Find a node by slug anywhere in the tree. */
export function findNode(nodes: NavNode[], slug: string): NavNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findNode(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

/**
 * Return the href of the first routed descendant (a node with `hasPage` and an
 * `href`), walking children depth-first in order. Returns undefined when the
 * subtree has no routed page.
 *
 * Used by CategoryNav's `categories=` mode to give a `category_no_page` card a
 * real destination: such a category has no route of its own (collectAutoIndexNodes
 * skips noPage nodes), so a card linking to its own slug URL would be a dead
 * link. Linking to the first child page keeps the route surface unchanged.
 */
export function firstRoutedHref(node: NavNode): string | undefined {
  for (const child of node.children) {
    if (child.hasPage && child.href) return child.href;
    const nested = firstRoutedHref(child);
    if (nested) return nested;
  }
  return undefined;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Build breadcrumb trail by walking the nav tree.
 *
 * Nav-node hrefs are always the LATEST `docsUrl(slug, lang)` values (see the
 * `buildHref` wiring in `buildNavTree`). On versioned routes that would make
 * breadcrumbs link back to
 * latest content (#1916 #1). Pass an optional `hrefFor(slug)` to remap each
 * intermediate crumb's href to the route's own URL space (e.g.
 * `versionedDocsUrl`-bound). The home crumb and the current/last crumb carry no
 * remappable href and are left untouched. Omit `hrefFor` (latest routes) to
 * keep the unversioned hrefs.
 */
export function buildBreadcrumbs(
  tree: NavNode[],
  slug: string,
  lang: Locale = defaultLocale,
  hrefFor?: (slug: string) => string,
): BreadcrumbItem[] {
  const parts = slug.split("/");
  const homeHref = lang === defaultLocale ? withBase("/") : withBase(`/${lang}/`);
  const crumbs: BreadcrumbItem[] = [{ label: "", href: homeHref }];
  let nodes = tree;

  for (let i = 0; i < parts.length; i++) {
    const partialSlug = parts.slice(0, i + 1).join("/");
    const node = nodes.find((n) => n.slug === partialSlug);
    if (!node) break;

    const isLast = i === parts.length - 1;
    const href = isLast
      ? undefined
      : hrefFor && node.href !== undefined
        ? hrefFor(node.slug)
        : node.href;
    crumbs.push({
      label: node.label,
      href,
    });
    nodes = node.children;
  }

  return crumbs;
}
