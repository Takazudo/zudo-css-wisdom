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
//
// Enumeration + per-entry derived data are built by the shared, memoized
// buildDocRouteEntries (#2010); rendering by the shared renderDocPage. This
// file owns only the route's nav source and the param/prop shapes.

import { settings } from "@/config/settings";
import { getLocaleConfig, type Locale } from "@/config/i18n";
import type { JSX } from "preact";
import { resolveNavSource } from "../../lib/_nav-source-docs";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../../lib/doc-page-props";
import { buildDocRouteEntries } from "../../lib/_doc-route-entries";
import { renderDocPage } from "../../lib/_doc-page-renderer";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
 * Fallback detection (`isFallback`) comes from the merge's localeSlugSet —
 * the component uses it to show the "not yet translated" notice (matching
 * the Astro original).
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
    const localeConfig = getLocaleConfig(locale);
    const contentDir = localeConfig?.dir ?? settings.docsDir;

    // Identity-stable, locale-first merge with EN fallback. The same `docs` /
    // `navDocs` / `categoryMeta` instances are reused across this route's many
    // per-page paths() invocations so both buildNavTree's identity fast-path
    // and the buildDocRouteEntries memo key on them — see
    // pages/lib/_nav-source-docs.ts (#1902).
    const source = resolveNavSource(locale as Locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    for (const item of buildDocRouteEntries({
      source,
      locale: locale as Locale,
      routeSig: `locale-docs;${locale}`,
    })) {
      // isFallback: page came from base docs, not the locale collection.
      // Always false for autoIndex items (item.isFallback already is).
      const extra: LocaleDocPageExtra = {
        contentDir: item.isFallback ? settings.docsDir : contentDir,
        isFallback: item.isFallback,
      };
      result.push({
        params: { locale, slug: item.slugParams },
        props:
          item.props.kind === "entry"
            ? { ...item.props, ...extra }
            : { ...item.props, ...extra },
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
  return renderDocPage(props, {
    locale: props.params.locale as Locale,
    isFallback: props.isFallback,
    docHistoryContentDir: props.contentDir,
  });
}
