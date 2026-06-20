/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// og:title / og:description / color-scheme head injection for the zfb doc pages.
//
// Why this wrapper exists: the v2 `<DocLayout>` shell exposes a `head` slot
// but intentionally does NOT emit og:* meta or mount `<ColorSchemeProvider>` —
// that is the host's responsibility.
//
// Without OgTags the SSG output is missing og:title / og:description,
// which crawlers and link-preview tools rely on. Without ColorSchemeProvider
// the runtime `:root { --zd-* }` palette is missing, so every component that
// resolves a color via `--zd-*` (search match-keyword highlight, image-overlay,
// etc.) falls back to UA defaults — and the smoke-search "matched
// keywords" regression guard at e2e/smoke-search.spec.ts:167 fires
// because `getComputedStyle(root).getPropertyValue("--zd-matched-keyword-bg")`
// returns "" instead of the resolved palette token.
//
// (#1355 wave 13 — ColorSchemeProvider mount restored after the retirement of
// the zfb cutover's initial setup.)

import type { JSX } from "preact";
import { OgTags, TwitterCard } from "@takazudo/zudo-doc/head";
import { SIDEBAR_RESIZER_RESTORE_SCRIPT } from "@takazudo/zudo-doc/sidebar-resizer";
// Import ColorSchemeProvider from the dedicated
// `./theme/color-scheme-provider` subpath rather than the
// "@takazudo/zudo-doc/theme" barrel — the barrel also re-exports the
// ColorTweakExportModal island and the design-token SerDe/iframe-bridge
// modules, which this SSR-only head emission does not need in its zfb
// esbuild graph.
import ColorSchemeProvider from "@takazudo/zudo-doc/theme/color-scheme-provider";
import { composeMetaTitle } from "./_compose-meta-title";
import { withBase, absoluteUrl } from "@/utils/base";
import { settings } from "@/config/settings";
// W3B (#1730): cssText + colorMode are precomputed here — the v2
// ColorSchemeProvider no longer reaches into the host config tree.
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
} from "@/config/color-scheme-utils";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
  /**
   * Absolute canonical URL for this page. When supplied, emits
   * <link rel="canonical" href="...">. Compute via `absoluteUrl(pageUrl)`
   * (@/utils/base) in each host page; it returns undefined when
   * settings.siteUrl is empty so the link is simply omitted.
   */
  canonical?: string;
}

/**
 * Default-bearing host wrapper that injects og:title / og:description,
 * the ColorSchemeProvider (`:root { --zd-* }` palette + theme bootstrap),
 * the favicon link, and an optional canonical link into the v2 layout's
 * `head` slot.
 *
 * og:title is run through composeMetaTitle so it matches the
 * "<title> | <siteName>" shape emitted by the host's <title> element
 * (the legacy Astro layout produced both shapes; the zfb host has to
 * compose them itself).
 *
 * og:title is always emitted — it is the unconditional DocHead contract
 * (OgTags always emits og:title regardless of settings). All other tags
 * are gated by settings.metaTags.
 *
 * Pure SSR — no state, no client-only imports. Intended for use as:
 *   head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
 * on every DocLayoutWithDefaults call site in the host pages.
 */
export function HeadWithDefaults({
  title,
  description,
  canonical,
}: HeadWithDefaultsProps): JSX.Element {
  const { metaTags } = settings;

  // og:image / twitter:image must be absolute URLs — crawlers silently drop
  // relative og:image values. absoluteUrl joins siteUrl (no trailing slash) +
  // the base-prefixed asset path, and returns undefined when siteUrl is empty
  // (e.g. a freshly scaffolded create-zudo-doc project that hasn't configured
  // siteUrl yet) so we never ship a useless relative og:image. OgTags /
  // TwitterCard already gate their image emission on the prop being defined;
  // the og:image:* companion tags below are gated explicitly because they
  // would dangle without the parent og:image.
  const ogImageUrl =
    metaTags.ogImage !== false
      ? absoluteUrl(withBase(metaTags.ogImage))
      : undefined;

  // Resolve the palette CSS body once per page render (the v2 component
  // is pure SSR — no caching needed).
  const colorMode = settings.colorMode ? settings.colorMode : null;
  const cssText = colorMode
    ? generateLightDarkCssProperties()
    : generateCssCustomProperties();

  return (
    <>
      <OgTags
        title={composeMetaTitle(title)}
        description={metaTags.description ? description : undefined}
        ogType="website"
        ogUrl={canonical}
        ogImage={ogImageUrl}
        ogSiteName={metaTags.ogSiteName ? settings.siteName : undefined}
      />
      {metaTags.keywords !== false && metaTags.keywords.length > 0 && (
        <meta name="keywords" content={metaTags.keywords} />
      )}
      {/* og:image:width / og:image:height / og:image:alt — not in OgTags API;
          emitted here directly to avoid expanding the shared HeadProps surface.
          Standard 1200×630 social preview dimensions. Gated on ogImageUrl so
          the companion tags don't dangle when og:image itself was suppressed. */}
      {ogImageUrl !== undefined && (
        <>
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={composeMetaTitle(title)} />
        </>
      )}
      {metaTags.twitterCard !== false && (
        <TwitterCard
          card={metaTags.twitterCard}
          image={ogImageUrl}
          site={metaTags.twitterSite}
          creator={metaTags.twitterCreator}
        />
      )}
      <ColorSchemeProvider cssText={cssText} colorMode={colorMode} />
      {/* Noto Sans JP — body font; loaded asynchronously (media="print" → onload trick)
          to avoid blocking first paint. Mirrors the original Astro layout's font
          loading strategy (src/layouts/doc-layout.astro). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap"
        media="print"
        // @ts-ignore — onload is a valid HTMLLinkElement attribute at runtime
        onload="this.media='all'"
      />
      {/* Pre-paint inline script: restore persisted sidebar width to
          --zd-sidebar-w on :root before first paint, so a reload after
          drag-resizing the sidebar doesn't snap back to the CSS default
          clamp() width. Mirrors the sibling sidebar-toggle restore
          script emitted from the page's afterSidebar slot. */}
      {settings.sidebarResizer && <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }} />}
      {/* favicon set — withBase() handles the configured base path prefix */}
      <link rel="icon" href={withBase("/favicon.ico")} sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href={withBase("/favicon-32x32.png")} />
      <link rel="icon" type="image/png" sizes="16x16" href={withBase("/favicon-16x16.png")} />
      {canonical !== undefined && <link rel="canonical" href={canonical} />}
    </>
  );
}
