/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware DocMetainfo area wrapper for the zfb doc pages.
//
// Renders the visible date block (created / updated dates + author)
// between the article <h1> and the description paragraph (doc-metainfo
// placement — between <h1> and description).
//
// Data source: `.zfb/doc-history-meta.json`, a build-time manifest
// emitted by `scripts/zfb-prebuild.mjs` before `zfb build` runs.
// esbuild inlines the JSON statically so no Node.js `fs` code reaches
// the client bundle — the same approach used by `_doc-history-area.tsx`
// (b11-2 pattern).
//
// Date formatting uses Intl.DateTimeFormat (browser-safe). We do NOT
// import the old `formatDate` from `src/utils/git-info.ts` — that module
// carried top-level Node.js imports (`execFileSync`, `existsSync`) that
// would be dragged into the client bundle (the B-11 lesson). That file
// was removed in S1 cleanup (#1928); the mirror below is the canonical copy.
//
// Labels are resolved from the project's i18n table so non-default
// locales (e.g. /ja/) get translated "作成" / "更新" strings.

import type { VNode } from "preact";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { DocMetainfo } from "@takazudo/zudo-doc/metainfo";
import { toHistorySlug } from "@/utils/slug";
// SSR author + date metadata comes from `.zfb/doc-history-meta.json`, a
// build-time manifest emitted by `scripts/zfb-prebuild.mjs` (step 2:
// doc-history-meta) before `zfb build` runs. esbuild inlines the JSON
// statically so no Node-only `fs` code reaches the client bundle.
// The `#doc-history-meta` alias is defined in tsconfig.json and resolves
// to the absolute path of `.zfb/doc-history-meta.json` — this is needed
// because the zfb bundler builds pages from a shadow tree; relative paths
// across the shadow boundary would resolve to the wrong location.
import docHistoryMeta from "#doc-history-meta";

// BCP-47 locale tag mapping used by Intl.DateTimeFormat.
// Originally mirrored from `src/utils/git-info.ts` (removed in S1 #1928).
// The formatDate function below is the stable copy; kept in sync manually.
const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  de: "de-DE",
};

/** Format an ISO date string for display, respecting the active locale. */
function formatDate(isoDate: string, locale: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface DocMetainfoAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * True when this locale page falls back to the base EN collection
   * (i.e. the slug has no translation for the active locale). When true,
   * the manifest lookup uses defaultLocale so the visible block resolves
   * the bare-slug key — the only key that exists for EN-origin files —
   * matching the dropdown's `effectiveHistoryLocale` derivation in
   * _doc-history-area.tsx. Display formatting (dates + labels) still uses
   * the active locale so JA users see JA formatting on fallback pages.
   */
  isFallback?: boolean;
}

/**
 * Renders the visible date block (Created / Updated / Author) when
 * `settings.docMetainfo` is enabled and the build-time manifest has an
 * entry for the active page.
 *
 * Returns null when `docMetainfo` is disabled, the page is untracked
 * (no manifest entry), or the manifest was generated in a shallow clone
 * (`SKIP_DOC_HISTORY=1` → empty JSON).
 *
 * The component is intentionally server-render-only: it emits static
 * HTML from build-time data and has no client JS footprint. It sits
 * between `<h1>` and the description `<p>` (doc-metainfo placement).
 */
export function DocMetainfoArea({ slug, locale, isFallback }: DocMetainfoAreaProps): VNode | null {
  if (!settings.docMetainfo) return null;

  // Doc-history storage sentinel ("" -> "index"): a root index page has the
  // canonical route slug "" (→ /docs/), but the prebuild keys the root entry
  // under "index" (collectContentFiles keeps the bare root; an empty path
  // segment is unroutable). Apply the sentinel BEFORE locale composition so
  // the visible Created/Updated/Author block resolves for a root page — see
  // @/utils/slug `toHistorySlug` and _doc-history-area.tsx. (#1891)
  const historySlug = toHistorySlug(slug);

  // On EN-fallback locale pages the manifest only has the bare
  // (non-locale-prefixed) key — the prebuild writes locale-prefixed keys
  // only for files physically present in the locale collection. Use
  // defaultLocale for the data lookup when isFallback is true, mirroring
  // `effectiveHistoryLocale` in _doc-history-area.tsx so the visible block
  // and the dropdown agree. Display formatting keeps the active locale.
  const effectiveHistoryLocale = isFallback ? defaultLocale : locale;

  // Key format: bare slug for default locale, "<locale>/<slug>" for others.
  // Matches the prebuild step's composedSlug logic (pre-build.ts).
  const composedSlug =
    effectiveHistoryLocale === defaultLocale
      ? historySlug
      : `${effectiveHistoryLocale}/${historySlug}`;

  type MetaEntry = { author: string; createdDate: string; updatedDate: string };
  const meta = (docHistoryMeta as Record<string, MetaEntry>)[composedSlug];

  if (!meta) return null;

  return (
    <DocMetainfo
      createdAt={meta.createdDate ? formatDate(meta.createdDate, locale) : null}
      updatedAt={meta.updatedDate ? formatDate(meta.updatedDate, locale) : null}
      author={meta.author || null}
      createdLabel={t("doc.created", locale)}
      updatedLabel={t("doc.updated", locale)}
    />
  );
}
