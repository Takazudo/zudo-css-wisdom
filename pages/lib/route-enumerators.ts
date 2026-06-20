// Pure URL-enumeration helpers shared by both page paths() functions and the
// sitemap. Extracting these prevents the sitemap from drifting out of sync
// with the actual routes the page modules produce.
//
// Each enumerator returns absolute paths (with settings.base prefix and
// trailing slash applied) as expected by the sitemap and page modules.
// `enumerateAllRoutes()` composes the others and returns a deduped
// Map<url, lastmod> that the sitemap renderer wraps directly.
//
// Design principles:
//   - Draft pages are always excluded (never built).
//   - Unlisted pages ARE included — they have real HTML files and should
//     appear in the sitemap even though they're hidden from nav.
//   - toRouteSlug() is applied to all entry ids so category index pages
//     (e.g. "getting-started/index" → "getting-started") get correct URLs.
//   - Auto-generated category index pages (categories without index.mdx) are
//     emitted by building the nav tree and calling collectAutoIndexNodes.

import { loadDocs } from "../_data";
import { mergeLocaleDocs } from "./locale-merge";
import { resolveNavSource, resolveVersionedLocaleSource } from "./_nav-source-docs";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import type { VersionConfig } from "@/config/settings";
import type { DocsEntry } from "@/types/docs-entry";
import { docsUrl, versionedDocsUrl, withBase } from "@/utils/base";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import {
  buildNavTree,
  collectAutoIndexNodes,
} from "@/utils/docs";

// ---------------------------------------------------------------------------
// enumerateDocsRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc page URLs for a locale.
 *
 * For the default locale: loads the "docs" collection directly.
 * For non-default locales: inlines a locale-first merge — locale docs take
 * priority; base EN docs fill in slugs not covered by the locale collection,
 * with default-locale-only paths excluded. A nav-tree pass then adds
 * auto-generated category index pages.
 *
 * Applies toRouteSlug so "category/index" entries become "category/" URLs.
 * Returns deduplicated URL strings with base prefix and trailing slash.
 */
export function enumerateDocsRoutes(locale: string): string[] {
  const urls: string[] = [];

  // Identity-stable nav source — same instances the doc routes use, so the
  // nav-tree fast-path applies here too (#1902).
  const { docs: allDocs, navDocs, categoryMeta } = resolveNavSource(
    locale as Locale,
    undefined,
    { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
  );
  const tree = buildNavTree(navDocs, locale as Locale, categoryMeta);

  for (const doc of allDocs) {
    // A `category_no_page` index.mdx is metadata-only — no route, so no sitemap
    // URL. Same exclusion the doc-route paths() apply (zfb retains every .mdx
    // as a collection entry, so the skip must be explicit).
    if (doc.data.category_no_page === true) continue;
    // Canonical route slug via the one shared rule (@/utils/slug). `doc.id` is
    // already `toRouteSlug(doc.slug)` (bridged through stripIndexSuffix in
    // pages/_data.ts), so a bare root index.mdx is "" here → `/docs/` — the
    // canonical root URL (#1891). The `toRouteSlug` fallback is a redundant
    // safety re-application of the same rule (idempotent on the already-
    // stripped id); kept so this enumerator's slug derivation reads as a
    // single explicit call to the canonical helper.
    urls.push(docsUrl(doc.data.slug ?? toRouteSlug(doc.id), locale as Locale));
  }
  for (const node of collectAutoIndexNodes(tree)) {
    urls.push(docsUrl(node.slug, locale as Locale));
  }

  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// enumerateTagsRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate tag-index and per-tag URLs for a locale.
 *
 * Uses the same tag map as the tag pages (unlisted + draft excluded) so the
 * sitemap lists exactly the same tag pages that get built.
 *
 * Returns:
 *   - /docs/tags/ (or /{locale}/docs/tags/)
 *   - /docs/tags/{tag}/ (or /{locale}/docs/tags/{tag}/) for each unique tag
 */
export function enumerateTagsRoutes(locale: string): string[] {
  if (!settings.docTags) return [];

  const urls: string[] = [];

  const tagsBase =
    locale === defaultLocale ? "/docs/tags" : `/${locale}/docs/tags`;
  urls.push(withBase(tagsBase));

  // Collect tags from the same merged doc set the tag pages use.
  // Filter unlisted + draft + category_no_page — mirrors the tag [tag].tsx
  // pages so the sitemap lists exactly the tag pages that get built (a
  // category_no_page index has no route, so a tag it carries must not coin a
  // tag page that links back to it). The category_no_page drop happens AFTER
  // the locale merge so a locale override carrying the flag first wins the
  // merge — pre-merge filtering would let the unflagged base doc resurface.
  let docs: DocsEntry[];
  if (locale === defaultLocale) {
    docs = loadDocs("docs").filter(
      (d) => !d.data.unlisted && !d.data.draft && !d.data.category_no_page,
    );
  } else {
    const result = mergeLocaleDocs({
      baseDocs: loadDocs("docs").filter((d) => !d.data.draft),
      localeDocs: loadDocs(`docs-${locale}`).filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    docs = result.docs.filter((d) => !d.data.category_no_page);
  }

  const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

  for (const tag of tagMap.keys()) {
    // Tag segment URL-encoded — these URLs feed the sitemap, which must
    // carry well-formed encoded URLs (e.g. "type:guide" → "type%3Aguide").
    // Route params (the page paths() functions) stay raw.
    const encoded = encodeURIComponent(tag);
    const tagPath =
      locale === defaultLocale
        ? `/docs/tags/${encoded}`
        : `/${locale}/docs/tags/${encoded}`;
    urls.push(withBase(tagPath));
  }

  return urls;
}

// ---------------------------------------------------------------------------
// enumerateVersionedRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate doc URLs for a single (version, locale) combination.
 *
 * For the default locale: loads `docs-v-${version.slug}`.
 * For non-default locales: locale-first merge — locale-specific collection
 * takes priority; base EN collection fills in pages not yet translated.
 * If the locale collection doesn't exist for this version, all pages fall
 * back to the EN base (matching the page module's behaviour).
 *
 * Returns versioned URLs like /v/{version}/docs/{slug}/ or
 * /v/{version}/{locale}/docs/{slug}/.
 */
export function enumerateVersionedRoutes(
  version: VersionConfig,
  locale: string,
): string[] {
  const urls: string[] = [];

  if (locale === defaultLocale) {
    // Versioned EN base — identity-stable source (#1902).
    const { docs: allDocs, navDocs, categoryMeta } = resolveNavSource(
      "en",
      version.slug,
    );
    const tree = buildNavTree(navDocs, "en", categoryMeta);

    for (const doc of allDocs) {
      // category_no_page index.mdx → no route, no sitemap URL (see paths()).
      if (doc.data.category_no_page === true) continue;
      const slug = doc.data.slug ?? toRouteSlug(doc.id);
      urls.push(versionedDocsUrl(slug, version.slug));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(versionedDocsUrl(node.slug, version.slug));
    }
  } else {
    const localeDir = version.locales?.[locale]?.dir;

    // Versioned locale source — locale-first merge over the version's EN base
    // (identity-stable; #1902).
    const { docs: allDocs, navDocs, categoryMeta } = resolveVersionedLocaleSource(
      version.slug,
      version.docsDir,
      locale as Locale,
      localeDir,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
    const tree = buildNavTree(navDocs, locale as Locale, categoryMeta);

    for (const doc of allDocs) {
      // category_no_page index.mdx → no route, no sitemap URL (see paths()).
      if (doc.data.category_no_page === true) continue;
      const slug = doc.data.slug ?? toRouteSlug(doc.id);
      urls.push(versionedDocsUrl(slug, version.slug, locale as Locale));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(versionedDocsUrl(node.slug, version.slug, locale as Locale));
    }
  }

  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// enumerateAllRoutes
// ---------------------------------------------------------------------------

/**
 * Compose all route enumerators into a deduped Map<url, lastmod>.
 *
 * Covers:
 *   - Site root
 *   - Default-locale docs + tags
 *   - Per-locale homepages, docs, and tags
 *   - Versioned EN docs (for each version in settings.versions)
 *   - Versioned locale docs (for each locale in settings.locales)
 *
 * The map keys are absolute paths (with settings.base prefix + trailing
 * slash). The sitemap renderer prefixes each with settings.siteUrl.
 */
export function enumerateAllRoutes(): Map<string, string> {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const routes = new Map<string, string>();

  function add(url: string): void {
    if (!routes.has(url)) {
      routes.set(url, today);
    }
  }

  // Site root
  add(withBase("/"));

  // Default locale docs
  for (const url of enumerateDocsRoutes(defaultLocale)) {
    add(url);
  }

  // Default locale tags
  for (const url of enumerateTagsRoutes(defaultLocale)) {
    add(url);
  }

  // Non-default locales
  for (const locale of Object.keys(settings.locales)) {
    add(withBase(`/${locale}`));

    for (const url of enumerateDocsRoutes(locale)) {
      add(url);
    }

    for (const url of enumerateTagsRoutes(locale)) {
      add(url);
    }
  }

  // Versions listing pages — /docs/versions/ and /{locale}/docs/versions/.
  // These static utility pages are built by pages/docs/versions.tsx and
  // pages/[locale]/docs/versions.tsx whenever versioning is configured.
  // They are not part of any content collection so they are added explicitly.
  if (settings.versions) {
    add(withBase("/docs/versions"));
    for (const locale of Object.keys(settings.locales)) {
      add(withBase(`/${locale}/docs/versions`));
    }
  }

  // Versioned docs
  if (settings.versions) {
    for (const version of settings.versions as VersionConfig[]) {
      for (const url of enumerateVersionedRoutes(version, defaultLocale)) {
        add(url);
      }
      // Non-default locales always have versioned pages (they fall back to EN
      // when a locale-specific collection is not configured).
      for (const locale of Object.keys(settings.locales)) {
        for (const url of enumerateVersionedRoutes(version, locale)) {
          add(url);
        }
      }
    }
  }

  return routes;
}
