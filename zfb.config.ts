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
    // Home-hero brand mark. MUST be set explicitly: zudo-doc's default is
    // `"auto"`, a generated SVG seeded by `siteName` that silently replaces
    // this site's own asset (the W banner settled in 84d2f19). Rendered as a
    // theme-adaptive CSS mask in `bg-fg`, which is why the source SVG is a
    // flat `fill:#fff` silhouette.
    logo: "/img/logo.svg",
    // Wide home grid on `/` and every locale home. Replaces the former
    // hand-reconstructed pages/index.tsx + pages/[locale]/index.tsx, which
    // existed only because zudo-doc 4.2.1 had no toggle for the wide band
    // (upstream request zudolab/zudo-doc#2959, pattern originated here in
    // PR #182). 4.4.x added `home.wide`, read by BOTH the package-owned root
    // and locale index routes, so those host overrides are gone and the
    // package routes are used again.
    home: { wide: true },
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
              href: "/docs/design-tokens/tight-token-strategy",
              locales: { ja: { label: "タイトトークン戦略" } },
            },
            {
              label: "Component First Strategy",
              href: "/docs/architecture/component-first-strategy",
              locales: { ja: { label: "コンポーネントファースト戦略" } },
            },
            {
              label: "Three-Tier Color Strategy",
              href: "/docs/color/three-tier-color-strategy",
              locales: { ja: { label: "3層カラー戦略" } },
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/">zudo-doc</a>. Enjoy synth on <a href="https://takazudomodular.com/">Takazudo Modular</a>.`,
    },
    // Grouped nav (epic #196): group parents get `label` + `path` only (path = their
    // first child's path) and MUST NOT carry `categoryMatch` — getCategoryOrder
    // (dist/nav-scope/index.js) flattens the parent's match AND every child's into
    // one list, so a parent repeating its first child's match would double-count
    // that category. Direct items and every child carry `categoryMatch` equal to
    // their top-level content directory name.
    headerNav: [
      { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
      {
        label: "Layout",
        path: "/docs/flexbox-and-grid",
        children: [
          { label: "Flexbox & Grid", path: "/docs/flexbox-and-grid", categoryMatch: "flexbox-and-grid" },
          { label: "Positioning", path: "/docs/positioning", categoryMatch: "positioning" },
          { label: "Sizing", path: "/docs/sizing", categoryMatch: "sizing" },
          { label: "Media", path: "/docs/media", categoryMatch: "media" },
          { label: "Document Layout", path: "/docs/document-layout", categoryMatch: "document-layout" },
        ],
      },
      {
        label: "Typography",
        path: "/docs/font-sizing",
        children: [
          { label: "Font Sizing", path: "/docs/font-sizing", categoryMatch: "font-sizing" },
          { label: "Fonts", path: "/docs/fonts", categoryMatch: "fonts" },
          { label: "Text Control", path: "/docs/text-control", categoryMatch: "text-control" },
        ],
      },
      {
        label: "Styling",
        path: "/docs/color",
        children: [
          { label: "Color", path: "/docs/color", categoryMatch: "color" },
          { label: "Effects", path: "/docs/effects", categoryMatch: "effects" },
          { label: "Shadows & Borders", path: "/docs/shadows-and-borders", categoryMatch: "shadows-and-borders" },
        ],
      },
      { label: "Responsive", path: "/docs/responsive", categoryMatch: "responsive" },
      {
        label: "Interactive",
        path: "/docs/states-and-transitions",
        children: [
          { label: "States & Transitions", path: "/docs/states-and-transitions", categoryMatch: "states-and-transitions" },
          { label: "Selectors", path: "/docs/selectors", categoryMatch: "selectors" },
          { label: "Scroll", path: "/docs/scroll", categoryMatch: "scroll" },
          { label: "Accessibility", path: "/docs/accessibility", categoryMatch: "accessibility" },
        ],
      },
      {
        label: "Methodology",
        path: "/docs/architecture",
        children: [
          { label: "Architecture", path: "/docs/architecture", categoryMatch: "architecture" },
          { label: "Design Tokens", path: "/docs/design-tokens", categoryMatch: "design-tokens" },
          { label: "Custom Properties", path: "/docs/custom-properties", categoryMatch: "custom-properties" },
          { label: "Design Principles", path: "/docs/design-principles", categoryMatch: "design-principles" },
        ],
      },
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
