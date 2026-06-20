// pages/_data.ts — zfb-compatible data helpers for doc page modules.
//
// Provides the bridge between zfb's CollectionEntry (from "zfb/content") and
// the utility functions in @/utils/docs that expect DocsEntry (which carries
// an `id` field mirroring Astro's collection entry id).
//
// Sync convention (ADR-004):
//   getCollection() resolves from the pre-loaded ContentSnapshot without an
//   async boundary. paths() exports call getDocs() without await. The Promise
//   wrapper on the type is a v0 artefact — the synchronous snapshot path is
//   the production contract.

import { getCollection } from "zfb/content";
import type { CollectionEntry } from "zfb/content";
import type { DocsData } from "@/config/docs-schema";
import type { DocsEntry } from "@/types/docs-entry";
import type { DocPageEntry } from "./lib/doc-page-props";
import { toRouteSlug } from "@/utils/slug";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Frontmatter shape shared by all docs collections (EN, locale, versioned).
 *
 * Re-exported alias for `DocsData` (the `z.infer`-derived type from
 * `src/config/docs-schema.ts`) so call sites that import `ZfbDocsData` from
 * `pages/_data` continue to work without changes.
 *
 * The `[key: string]: unknown` index signature comes from `.passthrough()` on
 * the zod schema — custom frontmatter keys remain accessible downstream (e.g.
 * for frontmatter-preview) without extra casting.
 */
export type ZfbDocsData = DocsData;

/**
 * zfb collection entry augmented with the `id` and `collection` fields that
 * @/utils/docs utility functions (buildNavTree, buildBreadcrumbs, …) expect
 * from DocsEntry.
 *
 * `id` is bridged from `slug` — in Astro, `id` was the file-path identifier
 * (e.g. "getting-started/intro"); in zfb, the same role is played by `slug`.
 * Mapping them keeps the utility functions working without modification.
 */
export type ZfbDocsEntry = CollectionEntry<ZfbDocsData> & {
  /** Bridged from `slug` for @/utils/docs compat. */
  id: string;
  /** Collection name, e.g. "docs", "docs-ja", "docs-v-1.0". */
  collection: string;
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load docs from a named collection synchronously (ADR-004 sync contract).
 *
 * `getCollection` resolves from the ContentSnapshot when called inside a
 * paths() evaluation. The `as unknown as` cast converts the nominal Promise
 * wrapper to a plain array — safe because the snapshot path is synchronous.
 *
 * The returned entries include:
 *   - All CollectionEntry fields (slug, data, body, module_specifier, Content)
 *   - `id` — same value as `slug`, for @/utils/docs compat
 *   - `collection` — the collection name, for DocsEntry compat
 */
export function getDocs(collectionName: string): ZfbDocsEntry[] {
  const entries = getCollection<ZfbDocsData>(collectionName);
  return entries.map((e) => ({
    ...e,
    // Astro-compat: strip a trailing `/index` from the entry id so
    // `getting-started/index.mdx` → id "getting-started" (matching
    // Astro 5's `glob()` collection loader). Downstream nav helpers
    // (`buildNavTree`, `buildBreadcrumbs`, …) keyed off the stripped
    // form long before zfb existed; emitting the unstripped slug here
    // produces ambiguous-URL collisions at paths()-expansion time.
    id: stripIndexSuffix(e.slug),
    collection: collectionName,
  }));
}

// The `id` field bridged onto every entry is the canonical route slug, so it
// routes through the one shared rule (`toRouteSlug` in @/utils/slug) — bare
// root `index` → "" (URL /docs/), nested `x/index` → "x". Previously this was
// a standalone copy of the strip logic (the lone "" dissenter of the five
// index-stripping sites); consolidating it here means there is one source of
// truth. See @/utils/slug for the canonical-root rationale (#1891 / #1873).
function stripIndexSuffix(slug: string): string {
  return toRouteSlug(slug);
}

/**
 * Augment a raw zfb collection result with the Astro-style
 * `id`/`collection` fields that downstream `@/utils/docs` helpers
 * (and the `DocPageEntry` extender shape used by `[...slug].tsx`
 * pages) expect. Use this when a page needs a typed array more
 * specific than `DocsEntry` — pages that only need `DocsEntry[]`
 * can use [`loadDocs`] / [`getDocs`] directly.
 */
export function bridgeEntries<T = ZfbDocsData>(
  entries: ReadonlyArray<CollectionEntry<T>>,
  collectionName: string,
): Array<CollectionEntry<T> & { id: string; collection: string }> {
  return entries.map((e) => ({
    ...e,
    id: stripIndexSuffix(e.slug),
    collection: collectionName,
  }));
}

/**
 * Typed bridge from a raw zfb collection result to `DocPageEntry[]`.
 *
 * This is the **single, justified** cast at the zfb/DocsEntry boundary.
 * `CollectionEntry<ZfbDocsData> & { id, collection }` structurally satisfies
 * `DocPageEntry` because:
 *   - `id` and `collection` are added by `bridgeEntries`
 *   - `data` (ZfbDocsData) structurally satisfies `DocsEntry.data` (all
 *     required/optional fields are present; the index signature is wider)
 *   - `body`, `slug`, `module_specifier`, `Content` are provided by
 *     `CollectionEntry<ZfbDocsData>`
 * The plain `as DocPageEntry[]` (not `as unknown as`) is intentional — it
 * expresses that this is a well-understood structural subtype relationship,
 * not an escape from the type system. The zfb type is the source of truth;
 * DocsEntry/DocPageEntry are local compatibility shapes for @/utils/docs.
 */
export function bridgeDocsEntries(
  entries: ReadonlyArray<CollectionEntry<ZfbDocsData>>,
  collectionName: string,
): DocPageEntry[] {
  return bridgeEntries(entries, collectionName) as DocPageEntry[];
}

/**
 * One-shot helper for paths()/render-time pages that just need a
 * `DocsEntry[]` for `@/utils/docs` consumption — wraps `getDocs` so
 * call sites stay one-line. Use this from any page that previously did
 * `getCollection("docs") as unknown as DocsEntry[]` — that idiom
 * silently dropped the `id`/`collection` fields the utility helpers
 * read, which threw `Cannot read properties of undefined` at runtime.
 *
 * `ZfbDocsEntry` structurally satisfies `DocsEntry`: it carries `id`,
 * `collection`, `data` (ZfbDocsData satisfies DocsEntry.data field-for-
 * field), `body`, plus the zfb-specific extras (`slug`, `Content`, etc.)
 * that DocsEntry does not require.
 */
export function loadDocs(collectionName: string): DocsEntry[] {
  return getDocs(collectionName);
}

/**
 * Filter out draft entries.
 * Drafts are always excluded in static-build paths() context.
 */
export function filterDrafts(entries: ZfbDocsEntry[]): ZfbDocsEntry[] {
  return entries.filter((e) => !e.data.draft);
}

