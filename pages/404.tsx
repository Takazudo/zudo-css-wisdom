/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the 404 route.
//
// The 404 page is a static route with no dynamic params. zfb emits it as
// dist/404.html so the host platform (Cloudflare Pages, Netlify, etc.) can
// serve it for unmatched requests. No paths() export needed.
//
// The original Astro page rendered the full html/head/body inline without
// DocLayout because the 404 page intentionally has no sidebar/TOC/header.
// This port wraps via DocLayoutWithDefaults with hideSidebar/hideToc plus
// a noindex meta so search engines do not index it.

import { defaultLocale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { withBase } from "@/utils/base";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import type { JSX } from "preact";
import { FooterWithDefaults } from "./lib/_footer-with-defaults";
import { HeaderWithDefaults } from "./lib/_header-with-defaults";
import { HeadWithDefaults } from "./lib/_head-with-defaults";
import { composeMetaTitle } from "./lib/_compose-meta-title";
import { BodyEndIslands } from "./lib/_body-end-islands";

export const frontmatter = { title: "404" };

export default function NotFoundPage(): JSX.Element {
  const locale = defaultLocale;
  const title = "Page Not Found";

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      head={<HeadWithDefaults title={title} />}
      lang={locale}
      noindex={true}
      hideSidebar={true}
      hideToc={true}
      // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
      // Sidebar island — its marker never hydrates for published-package
      // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
      // hidden on this page anyway (zudolab/zudo-doc#2057).
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <div class="min-h-[60vh] flex flex-col items-center justify-center px-hsp-2xl py-vsp-xl">
        <h1 class="text-display font-bold mb-vsp-md">404</h1>
        <p class="text-title text-muted mb-vsp-xl">Page not found.</p>
        <a
          href={withBase("/")}
          class="bg-accent px-hsp-lg py-vsp-xs font-medium text-bg hover:bg-accent-hover"
        >
          Back to Home
        </a>
      </div>
    </DocLayoutWithDefaults>
  );
}
