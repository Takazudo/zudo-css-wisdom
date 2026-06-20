/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed site index route.
//
// Non-default-locale site index. paths() emits one route per locale defined
// in settings.locales (never the default locale — that is handled by
// pages/index.tsx since prefixDefaultLocale is false).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }   — e.g. "ja"
//   props:  { locale }           — resolved locale passed to component
//
// Data flow (inside component — sync per ADR-004):
//   getCollection(`docs-${locale}`)  + base fallback merge
//   → buildNavTree()   → groupSatelliteNodes()
//   → collectTags()    → tag section

import { settings } from "@/config/settings";
import { t, getLocaleConfig, type Locale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import {
  buildNavTree,
  groupSatelliteNodes,
  loadCategoryMeta,
} from "@/utils/docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import type { JSX } from "preact";
import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import SiteTreeNav from "@/components/site-tree-nav";
import { resolveNavSource } from "../lib/_nav-source-docs";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { BodyEndIslands } from "../lib/_body-end-islands";

export const frontmatter = { title: "Home" };

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/** Emit one route per non-default locale. */
export function paths(): Array<{
  params: { locale: string };
  props: { locale: string };
}> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleIndexPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;

  // Guard: paths() only emits routes for locales defined in settings.locales,
  // but the component can still be exercised with an unconfigured locale value
  // (e.g. during testing or if the router dispatches an unexpected param).
  // Fail loudly rather than silently serving EN content under a bogus prefix.
  const cfg = getLocaleConfig(locale);
  if (!cfg) {
    throw new Error(`LocaleIndexPage: locale "${locale}" is not configured in settings.locales`);
  }

  // Identity-stable, locale-first merge with EN fallback (shared `navDocs`
  // instance). categoryMeta is intentionally locale-dir-only here — this page
  // historically did NOT merge in base meta (unlike the locale doc route), so
  // we keep that exact behavior to preserve output.
  const { navDocs } = resolveNavSource(locale as Locale, undefined, {
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });
  const categoryMeta = loadCategoryMeta(cfg.dir);

  const tree = buildNavTree(navDocs, locale as Locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  // Drop category_no_page index files so the count matches the number of tag
  // pages actually built (the tag routes exclude them too).
  const tagCount = collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(`/${locale}${ctaNav.path}`) : null;
  const logoUrl = withBase("/img/logo.svg");

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(settings.siteName)}
      head={<HeadWithDefaults title={settings.siteName} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
      // Sidebar island — its marker never hydrates for published-package
      // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
      // hidden on this page anyway (zudolab/zudo-doc#2057).
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale as Locale} currentPath={withBase(`/${locale}/`)} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      {/* Hero: logo left, title+desc+links right, block centered */}
      <div class="flex justify-center mb-vsp-xl">
        <div class="flex flex-col items-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">
          {/* Theme-adaptive logo: SVG used as a CSS mask over `bg-fg` so the
              foreground color follows the active theme (white on dark, black on
              light). The neighboring <h1>{settings.siteName}</h1> provides the
              accessible name; mirrors zudolab/zudo-design-token-lint#65. */}
          <div
            class="w-[320px] max-w-full aspect-[1200/630] bg-fg shrink-0"
            style={{
              WebkitMask: `url(${logoUrl}) center/contain no-repeat`,
              mask: `url(${logoUrl}) center/contain no-repeat`,
            }}
            aria-hidden="true"
          />
          <div>
            <h1 class="text-heading font-normal font-futura mb-vsp-2xs">{settings.siteName}</h1>
            <p class="text-muted text-small mb-vsp-sm">{settings.siteDescription}</p>
            <div class="flex items-center justify-center lg:justify-start gap-hsp-md text-small">
              {overview && (
                <>
                  <a href={overview} class="text-fg underline hover:text-accent">
                    {t("nav.overview", locale)}
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
              {settings.githubUrl && (
                <>
                  <a
                    href={settings.githubUrl as string}
                    class="inline-flex items-center gap-[0.3em] text-fg underline hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" class="w-[1em] h-[1em] shrink-0">
                      <path
                        fill="currentColor"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                      />
                    </svg>
                    GitHub
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
              {/* @Takazudo link — ported from pages/index.tsx (refs #1453).
                  The locale home was missing this trailing item, leaving a
                  dangling "/" separator after GitHub. */}
              <a
                href="https://x.com/Takazudo"
                class="text-fg underline hover:text-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                @Takazudo
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sitemap grid — SiteTreeNav island mirrors the EN home (refs #1453).
          The locale home was using DocsSitemap (vertical <details> list);
          replaced with the same SiteTreeNav island used by pages/index.tsx. */}
      {Island({
        when: "idle",
        children: (
          <SiteTreeNav
            tree={groupedTree}
            categoryOrder={categoryOrder}
            categoryIgnore={["inbox", "develop"]}
          />
        ),
      }) as unknown as VNode}

      {settings.docTags && tagCount > 0 && (
        <section class="mt-vsp-xl">
          <h2 class="text-title font-bold mb-vsp-md">
            {t("doc.allTags", locale)}
          </h2>
          <a
            href={withBase(`/${locale}/docs/tags`)}
            class="text-accent underline hover:text-accent-hover"
          >
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
