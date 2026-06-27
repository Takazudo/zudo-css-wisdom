// Thin stub — locale-merge moved to the package (epic #2344, S6).
// Re-exports the pure merge functions from @takazudo/zudo-doc/locale-merge
// and provides backward-compatible wrappers that inject the host singletons.
//
// `mergeLocaleDocs` is the main export: now the package function accepts an
// optional `isDefaultLocaleOnlyPath` injection in its options object. The host
// wrapper below injects the host's `isDefaultLocaleOnlyPath` automatically
// so all existing call sites — which pass `applyDefaultLocaleOnlyFilter: true`
// without explicitly passing the predicate — continue to work unchanged.
//
// `mergeCategoryMeta` is kept as a host-only helper (it wraps `loadCategoryMeta`
// from @/utils/docs which is a host import). The package's `nav-source-docs`
// factory now owns the merged-category-meta caching; this re-export is kept
// for any remaining host call sites.

export type {
  MergeDocsEntry,
  MergeLocaleDocsOptions,
  MergeLocaleDocsResult,
} from "@takazudo/zudo-doc/locale-merge";
import { mergeLocaleDocs as _mergeLocaleDocs } from "@takazudo/zudo-doc/locale-merge";
import type { MergeLocaleDocsOptions, MergeLocaleDocsResult, MergeDocsEntry } from "@takazudo/zudo-doc/locale-merge";
import { isDefaultLocaleOnlyPath } from "@/utils/base";
import { loadCategoryMeta } from "@/utils/docs";
import type { CategoryMeta } from "@/utils/docs";

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Thin host wrapper around the package's `mergeLocaleDocs` that injects
 * `isDefaultLocaleOnlyPath` from `@/utils/base` automatically. Existing call
 * sites that pass `applyDefaultLocaleOnlyFilter: true` continue to work
 * without change — the predicate is now injected rather than module-imported.
 */
export function mergeLocaleDocs<T extends MergeDocsEntry = MergeDocsEntry>(
  options: Omit<MergeLocaleDocsOptions<T>, "isDefaultLocaleOnlyPath">,
): MergeLocaleDocsResult<T> {
  return _mergeLocaleDocs({
    ...options,
    isDefaultLocaleOnlyPath,
  });
}

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
