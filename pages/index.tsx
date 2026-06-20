/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the site index route.
//
// Default-locale (EN) site index. Static route — no paths() export needed.
// Collects the EN docs tree and renders the site-map grid plus optional
// tag count.
//
// Data flow:
//   getCollection("docs")   [sync, zfb ADR-004]
//   → buildNavTree()        builds the nav tree for the sitemap grid
//   → collectTags()         counts unique tags for the tag section header
//   → DocLayoutWithDefaults renders the page with no sidebar/TOC

import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import {
  buildNavTree,
  groupSatelliteNodes,
} from "@/utils/docs";
import { resolveNavSource } from "./lib/_nav-source-docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import type { JSX } from "preact";
import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import SiteTreeNav from "@/components/site-tree-nav";
import { FooterWithDefaults } from "./lib/_footer-with-defaults";
import { HeaderWithDefaults } from "./lib/_header-with-defaults";
import { HeadWithDefaults } from "./lib/_head-with-defaults";
import { composeMetaTitle } from "./lib/_compose-meta-title";
import { BodyEndIslands } from "./lib/_body-end-islands";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

  // Identity-stable nav source (draft-filtered, unlisted retained). navDocs is
  // pre-filtered (isNavVisible) and shared with the nav-tree fast-path.
  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined);
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  // Drop category_no_page index files so the count matches the number of tag
  // pages actually built (the tag routes exclude them too).
  const tagCount = collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(ctaNav.path) : null;
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
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase("/")} />}
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
              {/* @Takazudo link — established in #1453 (project-specific brand link).
                  The deploy was missing this trailing item, leaving a dangling "/" separator. */}
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

      {/* Sitemap grid — restored to the original SiteTreeNav island (refs #1453).
          The Astro reference used <Island when="idle"><SiteTreeNav ...></Island>.
          DocsSitemap (vertical <details> list) was incorrect; SiteTreeNav gives
          the responsive multi-column grid the reference renders. */}
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
          <a href={withBase("/docs/tags")} class="text-accent underline hover:text-accent-hover">
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
