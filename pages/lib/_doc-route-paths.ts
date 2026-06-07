// Shared, pure prop-builder helpers for the 4 doc-route paths() functions.
//
// Extracted (#1917) from the near-verbatim paths() bodies of the 4 doc routes.
// These are version- and i18n-AGNOSTIC: every URL is produced by an injected
// `urlFor(slug) => string` closure, so the same code serves latest, locale,
// versioned, and versioned-locale routes without branching on context. The
// route file owns the closure (docsUrl vs versionedDocsUrl bound to its
// version/locale), which is what guarantees a latest-page pagination override
// is resolved + rewritten against the LATEST tree — it can never be rebound to
// a /v/ URL because a latest route never receives a versioned closure
// (#1916 correctness; see the behavioral tests).

import { flattenTree, findNode, type NavNode } from "@/utils/docs";

/** The two pagination-override fields read off entry frontmatter. */
export interface PaginationOverrides {
  /** `undefined` = no override; `null` = suppress; string = target slug. */
  pagination_prev?: string | null;
  pagination_next?: string | null;
}

/**
 * Resolve prev/next nav nodes for an entry against the route's OWN nav tree.
 *
 * - Sequential prev/next come from the flattened sub-tree (`subtreeFlat`).
 * - Frontmatter `pagination_prev` / `pagination_next` overrides resolve via
 *   `findNode(tree, …)` against the SAME `tree` the route built — never a
 *   foreign tree. The caller passes its own version/locale-scoped tree, so a
 *   `/v/` override resolves to a `/v/` node and a latest override to a latest
 *   node. (#1916 — pagination-override must bind to the correct tree.)
 *
 * Returns the raw NavNodes (hrefs untouched). Callers that need versioned
 * hrefs run the result through `rewriteNavHref` with their `urlFor` closure.
 */
export function resolveDocPrevNext(
  tree: NavNode[],
  subtreeFlat: NavNode[],
  slug: string,
  overrides: PaginationOverrides,
): { prev: NavNode | null; next: NavNode | null } {
  const idx = subtreeFlat.findIndex((n) => n.slug === slug);

  let prev = idx > 0 ? subtreeFlat[idx - 1] ?? null : null;
  let next = idx >= 0 && idx < subtreeFlat.length - 1 ? subtreeFlat[idx + 1] ?? null : null;

  if (overrides.pagination_prev !== undefined) {
    if (overrides.pagination_prev === null) {
      prev = null;
    } else {
      const found = findNode(tree, overrides.pagination_prev);
      prev = found ?? prev;
    }
  }
  if (overrides.pagination_next !== undefined) {
    if (overrides.pagination_next === null) {
      next = null;
    } else {
      const found = findNode(tree, overrides.pagination_next);
      next = found ?? next;
    }
  }

  return { prev, next };
}

/** Flatten the relevant sub-tree for an entry — convenience over flattenTree. */
export function flattenSubtree(subtree: NavNode[]): NavNode[] {
  return flattenTree(subtree);
}

/**
 * Rewrite a single nav node's href via the route's `urlFor` closure.
 *
 * Returns `null` for a `null` node. Latest routes pass `undefined` (leave the
 * href as the latest `docsUrl` already baked into the node); versioned routes
 * pass `urlFor` so prev/next links point at the versioned URL.
 */
export function rewriteNavHref(
  node: NavNode | null,
  urlFor: ((slug: string) => string) | undefined,
): NavNode | null {
  if (!node) return null;
  if (!urlFor) return node;
  return { ...node, href: urlFor(node.slug) };
}

/**
 * Remap an auto-index node's child-card hrefs via `urlFor`.
 *
 * #1916 #2: on versioned routes the children carry latest `docsUrl` hrefs
 * (every nav node does — see toNavNodes). They MUST be overridden to the
 * versioned URL ALWAYS, not only when `c.href` is missing. Passing `urlFor`
 * here does exactly that. Latest routes pass `undefined` to keep the original.
 */
export function remapNavChildHrefs(
  children: NavNode[],
  urlFor: ((slug: string) => string) | undefined,
): NavNode[] {
  if (!urlFor) return children;
  return children.map((c) => ({ ...c, href: urlFor(c.slug) }));
}
