// Shared, identity-stable nav-source resolver.
//
// Picks the right collection(s) and category-meta dir for an active
// (locale, version) pair, applying the locale-first + EN-fallback merge that
// the doc-route `paths()` passes use, so every nav surface (desktop sidebar,
// mobile SidebarToggle, route enumeration, MDX nav wrappers) sees the same
// data the pages enumerate.
//
// IDENTITY STABILITY (why this is not a thin wrapper)
// ---------------------------------------------------
// Every returned `docs` / `navDocs` array and `categoryMeta` Map is memoized
// so repeat callers within one build get the SAME instances. That is what lets
// `buildNavTree`'s identity fast-path (`src/utils/docs.ts`) skip the O(n log n)
// key computation on the ~900 calls a 251-page build makes. See
// `_nav-source-cache.ts` for the snapshot-anchored memo and the original-issue
// trace (zudolab/zudo-doc#1902 / #1882).
//
// Used by:
//   - _sidebar-with-defaults.tsx / _header-with-defaults.tsx (per-page nav)
//   - the 4 doc-route paths() files (route enumeration + nav tree)
//   - route-enumerators.ts (sitemap) and the MDX nav wrappers
// each picking the `NavSourceVariant` matching its filter needs.

import { defaultLocale, getLocaleConfig, type Locale } from "@/config/i18n";
import { settings } from "@/config/settings";
import {
  loadCategoryMeta,
  isNavVisible,
  type CategoryMeta,
} from "@/utils/docs";
import type { DocsEntry } from "@/types/docs-entry";
import type { DocPageEntry } from "./doc-page-props";
import { stableDocs, memoizeDerived } from "./_nav-source-cache";
import { mergeLocaleDocs } from "./locale-merge";

// ---------------------------------------------------------------------------
// Stable category-meta merge
// ---------------------------------------------------------------------------

// `loadCategoryMeta(dir)` is already memoized by dir (returns the same Map).
// The locale merge of two such Maps, however, was minted fresh on every call —
// breaking the `categoryMeta === categoryMeta` identity check in the nav-tree
// fast-path. Memoize the merge on the (baseDir, localeDir) pair.
const mergedCategoryMetaCache = new Map<string, Map<string, CategoryMeta>>();

/** Base metadata first, locale overrides win on overlapping keys — same merge
 *  order the locale doc-route paths() use. Returns a STABLE Map per
 *  (baseDir, localeDir) pair. */
export function stableMergeCategoryMeta(
  baseDir: string,
  localeDir: string,
): Map<string, CategoryMeta> {
  const key = `${baseDir}\n${localeDir}`;
  const cached = mergedCategoryMetaCache.get(key);
  if (cached) return cached;
  const merged = new Map<string, CategoryMeta>([
    ...loadCategoryMeta(baseDir),
    ...loadCategoryMeta(localeDir),
  ]);
  mergedCategoryMetaCache.set(key, merged);
  return merged;
}

// ---------------------------------------------------------------------------
// Stable navDocs (isNavVisible filter) derived from a stable docs array
// ---------------------------------------------------------------------------

/** `docs.filter(isNavVisible)`, memoized on the stable `docs` identity so the
 *  filtered array also has stable identity for the nav-tree fast-path. */
export function stableNavDocs<T extends DocsEntry>(docs: T[]): T[] {
  return memoizeDerived([docs], "navVisible", () => docs.filter(isNavVisible));
}

// ---------------------------------------------------------------------------
// Resolved nav source
// ---------------------------------------------------------------------------

export type NavSourceDocs = {
  /** Full doc list (merged + draft-filtered; unlisted retained per options). */
  docs: DocPageEntry[];
  /** `docs.filter(isNavVisible)` — stable instance for buildNavTree. */
  navDocs: DocPageEntry[];
  /** Stable category-meta Map for the active (locale, version). */
  categoryMeta: Map<string, CategoryMeta>;
  /** Slugs that came from the locale collection (for isFallback). Empty for
   *  default-locale / single-collection cases. */
  localeSlugSet: ReadonlySet<string>;
};

/**
 * How to filter the merged doc list. The locale merge takes different options
 * at different call sites; the option signature is folded into the memo key so
 * variants never collide on a shared cache entry.
 */
export interface NavSourceOptions {
  /** Drop base docs matching `defaultLocaleOnlyPrefixes` (route/sidebar nav). */
  applyDefaultLocaleOnlyFilter?: boolean;
  /** Retain `unlisted: true` docs (route enumeration + nav). */
  keepUnlisted?: boolean;
}

function optionSig(o: NavSourceOptions): string {
  return `dlo=${o.applyDefaultLocaleOnlyFilter ? 1 : 0};ku=${o.keepUnlisted ? 1 : 0}`;
}

const EMPTY_SLUG_SET: ReadonlySet<string> = new Set();

/**
 * Resolve the identity-stable nav source for an EN/locale (optionally
 * versioned) context. Every field is memoized so repeated calls with the same
 * logical inputs return the same instances.
 */
export function resolveNavSource(
  lang: Locale,
  currentVersion: string | undefined,
  options: NavSourceOptions = {},
): NavSourceDocs {
  const sig = optionSig(options);

  // --- Versioned. For a non-default locale the version IS configured for,
  //     delegate to resolveVersionedLocaleSource so every nav surface uses the
  //     SAME version-scoped locale-first merge the page body / route
  //     enumeration use (#1909) — keeping nav labels and locale-only version
  //     pages in sync. Otherwise (default locale, or the version not configured
  //     for this locale) fall back to the version's EN base collection.
  if (currentVersion) {
    // `versions` is `VersionConfig[] | false` — `false?.find` would throw
    // (optional chaining only short-circuits on null/undefined).
    const versionConfig = Array.isArray(settings.versions)
      ? settings.versions.find((v) => v.slug === currentVersion)
      : undefined;
    const localeDir = versionConfig?.locales?.[lang]?.dir;
    if (lang !== defaultLocale && localeDir) {
      return resolveVersionedLocaleSource(
        currentVersion,
        versionConfig?.docsDir ?? settings.docsDir,
        lang,
        localeDir,
        options,
      );
    }
    const docs = stableDocs(`docs-v-${currentVersion}`);
    const categoryMeta = loadCategoryMeta(versionConfig?.docsDir ?? settings.docsDir);
    const navDocs = stableNavDocs(docs);
    return { docs, navDocs, categoryMeta, localeSlugSet: EMPTY_SLUG_SET };
  }

  // --- Default locale: the "docs" collection directly.
  if (lang === defaultLocale) {
    const docs = stableDocs("docs");
    const categoryMeta = loadCategoryMeta(settings.docsDir);
    const navDocs = stableNavDocs(docs);
    return { docs, navDocs, categoryMeta, localeSlugSet: EMPTY_SLUG_SET };
  }

  // --- Non-default locale: locale-first merge with EN fallback.
  const baseDocs = stableDocs("docs");
  const localeDocs = stableDocs(`docs-${lang}`);

  const merged = memoizeDerived([baseDocs, localeDocs], `merge;${sig}`, () =>
    mergeLocaleDocs<DocPageEntry>({
      baseDocs,
      localeDocs,
      applyDefaultLocaleOnlyFilter: options.applyDefaultLocaleOnlyFilter,
      keepUnlisted: options.keepUnlisted,
    }),
  );
  const docs = merged.docs;

  const localeDir = getLocaleConfig(lang)?.dir ?? settings.docsDir;
  const categoryMeta = stableMergeCategoryMeta(settings.docsDir, localeDir);
  const navDocs = stableNavDocs(docs);

  return { docs, navDocs, categoryMeta, localeSlugSet: merged.localeSlugSet };
}

/**
 * Resolve the identity-stable nav source for a versioned non-default-locale
 * context — locale-specific version collection over the version's EN base.
 */
export function resolveVersionedLocaleSource(
  versionSlug: string,
  versionDocsDir: string,
  lang: Locale,
  localeDir: string | undefined,
  options: NavSourceOptions = {},
): NavSourceDocs {
  const sig = optionSig(options);
  const baseDocs = stableDocs(`docs-v-${versionSlug}`);
  const localeDocs = localeDir ? stableDocs(`docs-v-${versionSlug}-${lang}`) : EMPTY_DOCS;

  const merged = memoizeDerived(
    localeDir ? [baseDocs, localeDocs] : [baseDocs],
    `vmerge;${lang};${sig}`,
    () =>
      mergeLocaleDocs<DocPageEntry>({
        baseDocs,
        localeDocs,
        applyDefaultLocaleOnlyFilter: options.applyDefaultLocaleOnlyFilter,
        keepUnlisted: options.keepUnlisted,
      }),
  );
  const docs = merged.docs;

  const categoryMeta = localeDir
    ? stableMergeCategoryMeta(versionDocsDir, localeDir)
    : loadCategoryMeta(versionDocsDir);
  const navDocs = stableNavDocs(docs);

  return { docs, navDocs, categoryMeta, localeSlugSet: merged.localeSlugSet };
}

// Shared empty array for the "no locale collection" branch — stable identity
// keeps the merge memo consistent.
const EMPTY_DOCS: DocPageEntry[] = [];

// ---------------------------------------------------------------------------
// Back-compat: loadNavSourceDocs (sidebar + header consumers)
// ---------------------------------------------------------------------------

/**
 * Per-page nav source for the desktop sidebar and mobile SidebarToggle.
 *
 * Thin adapter over {@link resolveNavSource} with the sidebar's filter options
 * (`applyDefaultLocaleOnlyFilter`, `keepUnlisted`). Returns `navDocs` already
 * filtered so callers pass it straight to `buildSidebarForSection` without a
 * fresh `.filter(isNavVisible)` that would defeat the nav-tree fast-path.
 */
export function loadNavSourceDocs(
  lang: Locale,
  currentVersion: string | undefined,
): NavSourceDocs {
  return resolveNavSource(lang, currentVersion, {
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });
}
