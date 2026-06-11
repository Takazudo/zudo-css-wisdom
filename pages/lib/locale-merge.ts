// Shared utility for merging locale docs with base-locale fallbacks.
//
// Used by route enumerators, nav helpers, and locale page modules to implement
// the locale-first + base-fallback merge strategy.
//
// Strategy:
//   1. Caller loads the locale and base doc arrays (via loadDocs / bridgeEntries).
//   2. mergeLocaleDocs({ baseDocs, localeDocs, ... }) builds the merged list.
//   3. Locale docs take priority; base docs fill in slugs not present in locale.
//   4. Optionally excludes base docs that are default-locale-only paths.
//   5. Optionally filters out unlisted pages (for tag enumeration).
//
// WHY caller loads, helper merges:
//   Collection naming varies per context (regular docs, versioned, locale-versioned),
//   and the bridging (loadDocs vs. bridgeEntries) also varies per call site. Keeping
//   the helper as a pure merge over pre-loaded arrays avoids encoding that logic here
//   and lets each call site retain its own load pattern.
//
// This is a zfb-only module (synchronous, uses pre-loaded collections).

import { isDefaultLocaleOnlyPath } from "@/utils/base";
import type { DocsEntry } from "@/types/docs-entry";

// ---------------------------------------------------------------------------
// mergeLocaleDocs
// ---------------------------------------------------------------------------

/**
 * Options for mergeLocaleDocs.
 *
 * The generic parameter `T` allows callers to pass arrays of a DocsEntry
 * subtype (e.g. `DocPageEntry[]`) and get back results of the same subtype,
 * eliminating the need for `as unknown as` casts at call sites.
 */
export interface MergeLocaleDocsOptions<T extends DocsEntry = DocsEntry> {
  /** Pre-loaded base (EN/default-locale) docs array, already draft-filtered. */
  baseDocs: T[];
  /** Pre-loaded locale-specific docs array, already draft-filtered. */
  localeDocs: T[];
  /**
   * When true, base docs whose path matches a `defaultLocaleOnlyPrefixes`
   * entry are excluded from the merge result. This matches the behavior of the
   * inline copies in route-enumerators, nav helpers, and page paths() sections.
   *
   * Pass true for any call site that enumerates routes or builds nav trees for
   * non-default locales (where showing a default-locale-only page to a locale
   * user would be incorrect). Pass false (or omit) for call sites where the
   * filtered paths are harmless — e.g. category nav cards, taglist columns.
   *
   * @default false
   */
  applyDefaultLocaleOnlyFilter?: boolean;
  /**
   * Controls whether `unlisted: true` docs survive the merge.
   *
   * - `true`  — unlisted docs are RETAINED (locale + base). Route/sitemap
   *             enumeration uses this: unlisted pages have real HTML files, so
   *             they must be built; nav callers rely on `isNavVisible`
   *             downstream to hide them from the tree.
   * - `false` (default) — unlisted docs are DROPPED from both locale and base.
   *             Tag aggregation uses this so hidden pages don't contribute tags.
   *
   * @default false
   */
  keepUnlisted?: boolean;
}

/**
 * Result of mergeLocaleDocs.
 *
 * **Array identity:** Each call returns a fresh array — no module-level
 * memoization is applied. If a caller keys a cache on the docs array identity
 * (e.g. a nav-tree cache), it should memoize the result itself rather than
 * relying on reference stability from this helper.
 *
 * This contract is intentionally unchanged. The identity-stable layer for
 * nav-source arrays lives ABOVE this helper: `pages/lib/_nav-source-docs.ts`
 * (`resolveNavSource` / `resolveVersionedLocaleSource`) memoizes the merge
 * result on the snapshot-anchored input arrays + option signature (see
 * `pages/lib/_nav-source-cache.ts`), so `mergeLocaleDocs` itself stays a pure,
 * memo-free function (#1902).
 *
 * The generic `T` mirrors the parameter on {@link MergeLocaleDocsOptions} so
 * the returned `docs` array preserves the subtype of the input arrays.
 */
export interface MergeLocaleDocsResult<T extends DocsEntry = DocsEntry> {
  /**
   * Merged doc array: locale docs first, followed by base docs for slugs not
   * present in the locale collection (and not excluded by filter options).
   */
  docs: T[];
  /**
   * Set of slugs that came from the locale collection.
   * Useful for callers that need to determine whether a page is a fallback
   * (i.e. `isFallback = !localeSlugSet.has(slug)`).
   */
  localeSlugSet: ReadonlySet<string>;
}

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Locale docs take priority; base docs fill in slugs not covered by the locale
 * collection. Optionally excludes default-locale-only paths and/or unlisted pages.
 *
 * **Slug keying**: slug identity uses `d.data.slug ?? d.id`. Since `loadDocs`
 * already strips the `/index` suffix (via `stripIndexSuffix` in `_data.ts`),
 * this key is consistent across all call sites regardless of whether they
 * loaded docs via `loadDocs` or `bridgeEntries`.
 *
 * **Array identity**: returns a fresh array on each call — see
 * {@link MergeLocaleDocsResult} for caching guidance.
 */
export function mergeLocaleDocs<T extends DocsEntry = DocsEntry>(
  options: MergeLocaleDocsOptions<T>,
): MergeLocaleDocsResult<T> {
  const {
    baseDocs,
    localeDocs,
    applyDefaultLocaleOnlyFilter = false,
    keepUnlisted = false,
  } = options;

  const filteredLocale = keepUnlisted
    ? localeDocs
    : localeDocs.filter((d) => !d.data.unlisted);

  const filteredBase = keepUnlisted
    ? baseDocs
    : baseDocs.filter((d) => !d.data.unlisted);

  const localeSlugSet = new Set(filteredLocale.map((d) => d.data.slug ?? d.id));

  let fallbackDocs = filteredBase.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );

  if (applyDefaultLocaleOnlyFilter) {
    fallbackDocs = fallbackDocs.filter(
      (d) => !isDefaultLocaleOnlyPath(`/docs/${d.data.slug ?? d.id}`),
    );
  }

  return {
    docs: [...filteredLocale, ...fallbackDocs],
    localeSlugSet,
  };
}

// ---------------------------------------------------------------------------
// mergeCategoryMeta
// ---------------------------------------------------------------------------

import { loadCategoryMeta } from "@/utils/docs";
import type { CategoryMeta } from "@/utils/docs";

/**
 * Merge category metadata for a locale: base metadata first, locale overrides
 * win on overlapping keys.
 *
 * This matches the category-meta merge order used in route enumerators,
 * nav helpers, and page paths() sections.
 */
export function mergeCategoryMeta(
  baseDir: string,
  localeDir: string,
): Map<string, CategoryMeta> {
  return new Map<string, CategoryMeta>([
    ...loadCategoryMeta(baseDir),
    ...loadCategoryMeta(localeDir),
  ]);
}
