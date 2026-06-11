/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware DocHistory area wrapper for the zfb doc pages.
//
// Mirrors the Phase B-1 pattern used by _footer-with-defaults.tsx: this
// wrapper lives in pages/lib/ with a leading underscore so the zfb router
// skips it as a page module, while the two doc-page modules
// (docs/[...slug].tsx and [locale]/docs/[...slug].tsx) import it directly.
// It gates on settings.docHistory, resolves the correct locale prop
// (omitted for the default locale, matching the doc-history fetch-path
// branch in src/components/doc-history.tsx), and passes the assembled
// island into BodyFootUtilArea — restoring the
// `<section aria-label="Document utilities">` landmark and its Revision
// History heading in the SSG output for all zfb doc routes.
//
// Wave 8 (Path A — super-epic #1333 / child epic #1355): the doc-history
// island is now built right here using zfb's native `<Island ssrFallback>`
// API with the real DocHistory component imported from
// `@/components/doc-history`. Previously this file passed
// DocHistoryIslandProps to BodyFootUtilArea, which fed an SSR-skip
// wrapper that did not import the real component — the orphan-component
// bug that left the marker un-bundled. The host-side import here is the
// page → real-component chain zfb's island scanner walks.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { BodyFootUtilArea } from "@takazudo/zudo-doc/body-foot-util";
import { buildGitHubSourceUrl } from "@/utils/github";
import { DocHistory } from "@/components/doc-history";
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

// Set explicit `displayName` on the named-export DocHistory so zfb's
// `captureComponentName` produces a stable marker even after the SSR
// pipeline runs the component through a function-name-rewriting layer.
// (DocHistory is `export function DocHistory(...)` — `name` is already
// "DocHistory" but the explicit assignment is a guard for production
// minification regressions, mirroring the BodyEndIslands helper.)
(DocHistory as { displayName?: string }).displayName = "DocHistory";

interface DocHistoryAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * Raw zfb entry slug (relative path without extension), e.g.
   * "getting-started/intro" or "getting-started/index". Appended with
   * the source extension from the build-time manifest (".mdx" fallback)
   * to form the file path passed to buildGitHubSourceUrl.
   * Omit for auto-index pages (no underlying MDX file) — sourceUrl
   * will be suppressed automatically.
   */
  entrySlug?: string;
  /**
   * Content directory for the active locale, e.g. "src/content/docs"
   * or "src/content/docs-ja". Combined with entrySlug to build the
   * view-source GitHub URL. Omit to suppress the view-source link.
   */
  contentDir?: string;
  /**
   * True when this locale page falls back to the base EN collection
   * (i.e. the slug has no translation for the active locale). When true,
   * the history data-path derivations use defaultLocale so the island
   * fetches the correct bare-slug JSON and the SSR manifest lookup hits
   * the bare key — both of which only exist for EN-origin files.
   * Display labels (t() calls) still use the active locale so JA users
   * see JA labels on fallback pages. Omit (or false) for translated pages
   * and all other call sites (EN route, tag pages) — behavior unchanged.
   */
  isFallback?: boolean;
}

/**
 * Renders the `<BodyFootUtilArea>` shell with a doc-history island when
 * `settings.docHistory` is enabled.  Returns null otherwise so no empty
 * landmark appears on pages where history is disabled.
 *
 * The locale prop is forwarded to the real DocHistory component only for
 * non-default locales — the history JSON server stores default-locale
 * files without a locale path segment (matching the fetch-path branch in
 * doc-history.tsx).
 *
 * When entrySlug + contentDir are both provided and settings.bodyFootUtilArea
 * has viewSourceLink enabled, computes sourceUrl via buildGitHubSourceUrl and
 * resolves the i18n label for the active locale — keeping the v2 component
 * oblivious to project settings (host-side computation, B-8-2).
 *
 * The SSR fallback for the doc-history island is built from git metadata
 * (author name, created/updated dates) so that static HTML contains the
 * author marker before JS hydration, visible to screen readers and crawlers.
 */
export function DocHistoryArea({
  slug,
  locale,
  entrySlug,
  contentDir,
  isFallback,
}: DocHistoryAreaProps): VNode | null {
  if (!settings.docHistory) return null;

  // Doc-history storage sentinel ("" -> "index"): a root index page has the
  // canonical route slug "" (→ /docs/), but doc-history JSON and the meta
  // manifest store/serve the root entry under "index" (an empty path segment
  // is unroutable — the server regex and the prebuild key composition both
  // reject ""). Apply the sentinel to the slug segment BEFORE locale
  // composition so root pages resolve to e.g. /doc-history/index.json and the
  // meta key "ja/index". See @/utils/slug `toHistorySlug` and the
  // collectContentFiles walk in packages/doc-history-server. (#1891)
  const historySlug = toHistorySlug(slug);

  // On EN-fallback locale pages the history data exists only at the bare
  // (non-locale-prefixed) path — the prebuild/server writes locale-prefixed
  // keys/paths only for files physically present in the locale collection.
  // Use defaultLocale for data lookups when isFallback is true; keep locale
  // for all display label calls (t()) so JA users see JA labels.
  const effectiveHistoryLocale = isFallback ? defaultLocale : locale;

  // Look up the build-time manifest entry for this page. The composedSlug
  // matches the key written by the prebuild step: bare slug for the default
  // locale, "<localeKey>/<slug>" for non-default locales.
  const composedSlug =
    effectiveHistoryLocale === defaultLocale ? historySlug : `${effectiveHistoryLocale}/${historySlug}`;
  type MetaEntry = {
    author: string;
    createdDate: string;
    updatedDate: string;
    /** Source file extension (".mdx" | ".md") — optional in older manifests. */
    ext?: string;
  };
  const meta = (docHistoryMeta as Record<string, MetaEntry>)[composedSlug];

  // Locale-aware labels for the SSR fallback.
  const createdLabel = t("doc.created", locale);
  const updatedLabel = t("doc.updated", locale);
  const historyLabel = t("doc.history", locale);

  // Real-component props — locale omitted for the default locale.
  // Use effectiveHistoryLocale so fallback pages fetch the bare (non-ja/) path.
  const docHistoryLocale = effectiveHistoryLocale === defaultLocale ? undefined : effectiveHistoryLocale;
  const docHistoryBasePath = settings.base ?? "/";

  // Build the SSR fallback with only the sr-only metadata block so the
  // author marker and Created/Updated labels are present in SSG output
  // before JS hydration, discoverable by screen readers and crawlers.
  // The visible "History" trigger button is NOT included here — DocHistory
  // renders its own trigger after hydration, and including one in the
  // ssrFallback as well caused a duplicate button in the DOM because
  // Preact's render() does not reliably remove static ssrFallback HTML
  // before mounting the new component output (same wrapper-self-Island
  // pattern fixed for Toc/Sidebar in commit 4014cdc).
  const author = meta?.author;
  const createdDate = meta?.createdDate;
  const updatedDate = meta?.updatedDate;

  // Explicit type annotation omitted: inferred JSX return is structurally
  // compatible with zfb's VNode (the ssrFallback prop target). Preact's
  // VNode<{}> generic form is not directly assignable to zfb's VNode at the
  // type level even though the runtime shapes are identical.
  const fallback = (
    <div class="sr-only">
      {author && <span>{author}</span>}
      <span>
        {createdLabel}
        {createdDate ? `: ${createdDate}` : ""}
      </span>
      <span>
        {updatedLabel}
        {updatedDate ? `: ${updatedDate}` : ""}
      </span>
    </div>
  );

  // Compose the SSR-skip island with zfb's native `<Island ssrFallback>` API.
  // The page → this file → real DocHistory import chain is what the scanner
  // walks; the marker emitted is "DocHistory" via captureComponentName.
  const docHistoryIsland = Island({
    when: "idle",
    ssrFallback: fallback,
    children: (
      <DocHistory
        slug={historySlug}
        locale={docHistoryLocale}
        basePath={docHistoryBasePath}
      />
    ),
  }) as unknown as VNode;

  // Compute the view-source GitHub URL host-side so the v2 BodyFootUtilArea
  // component stays oblivious to project settings. Gate on
  // bodyFootUtilArea.viewSourceLink, and require both entrySlug and contentDir
  // (auto-index pages pass neither). The real source extension comes from the
  // build-time manifest (`ext`, written by pre-build.ts) — the content walkers
  // accept both .mdx and .md, so hardcoding ".mdx" produced broken view-source
  // URLs for .md pages. ".mdx" remains the fallback for entries without a
  // manifest record (untracked files, SKIP_DOC_HISTORY=1, stale manifests).
  const utilSettings = settings.bodyFootUtilArea;
  const sourceExt = meta?.ext ?? ".mdx";
  const sourceUrl =
    utilSettings && utilSettings.viewSourceLink && entrySlug && contentDir
      ? buildGitHubSourceUrl(contentDir, entrySlug + sourceExt)
      : null;

  // Resolve the i18n label host-side; pass the result so the v2 component
  // stays framework-agnostic. Falls back to the EN default when locale has
  // no translation (see DEFAULT_VIEW_SOURCE_LABEL in the v2 package).
  const viewSourceLabel = t("doc.viewSource", locale);

  return (
    <BodyFootUtilArea
      docHistoryIsland={docHistoryIsland}
      sourceUrl={sourceUrl}
      viewSourceLabel={viewSourceLabel}
    />
  );
}
