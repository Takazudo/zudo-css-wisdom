import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

// Single-entry v4 config. `zudoDoc()` returns a complete ZfbConfig and shallow-
// merges these fields over the package defaults, so only NON-default values are
// set here. Nested objects (metaTags / footer / bodyFootUtilArea) replace the
// default wholesale, so each is given in full. Theming is fully default — the
// custom color schemes + webfonts were dropped (tokens ship from
// @takazudo/zudo-doc/theme.css). Custom MDX demo components (CssPreview /
// TailwindPreview) are supplied via `chromeBindingsModule`.
export default defineConfig(
  zudoDoc({
    siteName: "zudo-css-wisdom",
    siteDescription: "Pragmatic CSS knowledge for AI",
    githubUrl: "https://github.com/Takazudo/zudo-css-wisdom",
    // siteUrl host MUST match the wrangler.toml custom-domain route.
    siteUrl: "https://zudo-css-wisdom.takazudomodular.com",
    metaTags: {
      description: true,
      keywords: false,
      ogImage: "/img/ogp.png",
      ogSiteName: true,
      twitterCard: "summary_large_image",
      twitterCreator: "@Takazudo",
    },
    locales: {
      ja: { label: "JA", dir: "src/content/docs-ja" },
    },
    // v4 default is `true` — this site does not use mermaid, so keep it off.
    mermaid: false,
    sitemap: true,
    docMetainfo: true,
    llmsTxt: true,
    cjkFriendly: true,
    docHistory: true,
    bodyFootUtilArea: {
      docHistory: true,
      viewSourceLink: false,
    },
    sidebarResizer: true,
    sidebarToggle: true,
    imageEnlarge: true,
    claudeResources: {
      claudeDir: ".claude",
    },
    footer: {
      links: [
        {
          title: "Fundamentals",
          locales: { ja: { title: "基本戦略" } },
          items: [
            {
              label: "Tight Token Strategy",
              href: "/docs/methodology/design-systems/tight-token-strategy",
              locales: { ja: { label: "タイトトークン戦略" } },
            },
            {
              label: "Component First Strategy",
              href: "/docs/methodology/architecture/component-first-strategy",
              locales: { ja: { label: "コンポーネントファースト戦略" } },
            },
            {
              label: "Three-Tier Color Strategy",
              href: "/docs/styling/color/three-tier-color-strategy",
              locales: { ja: { label: "3層カラー戦略" } },
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/">zudo-doc</a>. Enjoy synth on <a href="https://takazudomodular.com/">Takazudo Modular</a>.`,
    },
    headerNav: [
      { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
      { label: "Methodology", path: "/docs/methodology", categoryMatch: "methodology" },
      { label: "Layout", path: "/docs/layout", categoryMatch: "layout" },
      { label: "Typography", path: "/docs/typography", categoryMatch: "typography" },
      { label: "Styling", path: "/docs/styling", categoryMatch: "styling" },
      { label: "Responsive", path: "/docs/responsive", categoryMatch: "responsive" },
      { label: "Interactive", path: "/docs/interactive", categoryMatch: "interactive" },
      { label: "Claude", path: "/docs/claude", categoryMatch: "claude" },
    ],
    headerRightItems: [
      { type: "component", component: "github-link" },
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
      { type: "component", component: "language-switcher" },
    ],
    // Build-time-generated Claude resource docs are EN-only (gitignored); the
    // language switcher hides locale options under these prefixes.
    defaultLocaleOnlyPrefixes: [
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-commands/",
      "/docs/claude-agents/",
    ],
    // Host module supplying the custom MDX demo components (CssPreview /
    // TailwindPreview) via `chromeBindings.mdxExtras`.
    chromeBindingsModule: "src/chrome-bindings.ts",
    // Pinned dev/preview port (CLAUDE.md + local setup assume 8811).
    port: 8811,
    // Cloudflare Workers adapter — required for the deploy (dist/_worker.js).
    adapter: "@takazudo/zfb-adapter-cloudflare",
  }),
);
