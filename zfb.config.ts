import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { defaultTranslations } from "@takazudo/zudo-doc/i18n-defaults";

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
    //
    // Every item and child also carries `labelKey` (#203) — `renderNavItem` uses
    // `label` only when `labelKey` is absent, so the JA header renders localized
    // text via `translations` below instead of the hardcoded English `label`.
    // `label` stays as the literal fallback the type requires and as a readable
    // English anchor next to `categoryMatch`.
    headerNav: [
      { label: "Overview", labelKey: "nav.overview", path: "/docs/overview", categoryMatch: "overview" },
      {
        label: "Layout",
        labelKey: "nav.layout",
        path: "/docs/flexbox-and-grid",
        children: [
          { label: "Flexbox & Grid", labelKey: "nav.flexboxAndGrid", path: "/docs/flexbox-and-grid", categoryMatch: "flexbox-and-grid" },
          { label: "Positioning", labelKey: "nav.positioning", path: "/docs/positioning", categoryMatch: "positioning" },
          { label: "Sizing", labelKey: "nav.sizing", path: "/docs/sizing", categoryMatch: "sizing" },
          { label: "Media", labelKey: "nav.media", path: "/docs/media", categoryMatch: "media" },
          { label: "Document Layout", labelKey: "nav.documentLayout", path: "/docs/document-layout", categoryMatch: "document-layout" },
        ],
      },
      {
        label: "Typography",
        labelKey: "nav.typography",
        path: "/docs/font-sizing",
        children: [
          { label: "Font Sizing", labelKey: "nav.fontSizing", path: "/docs/font-sizing", categoryMatch: "font-sizing" },
          { label: "Fonts", labelKey: "nav.fonts", path: "/docs/fonts", categoryMatch: "fonts" },
          { label: "Text Control", labelKey: "nav.textControl", path: "/docs/text-control", categoryMatch: "text-control" },
        ],
      },
      {
        label: "Styling",
        labelKey: "nav.styling",
        path: "/docs/color",
        children: [
          { label: "Color", labelKey: "nav.color", path: "/docs/color", categoryMatch: "color" },
          { label: "Effects", labelKey: "nav.effects", path: "/docs/effects", categoryMatch: "effects" },
          { label: "Shadows & Borders", labelKey: "nav.shadowsAndBorders", path: "/docs/shadows-and-borders", categoryMatch: "shadows-and-borders" },
        ],
      },
      { label: "Responsive", labelKey: "nav.responsive", path: "/docs/responsive", categoryMatch: "responsive" },
      {
        label: "Interactive",
        labelKey: "nav.interactive",
        path: "/docs/states-and-transitions",
        children: [
          { label: "States & Transitions", labelKey: "nav.statesAndTransitions", path: "/docs/states-and-transitions", categoryMatch: "states-and-transitions" },
          { label: "Selectors", labelKey: "nav.selectors", path: "/docs/selectors", categoryMatch: "selectors" },
          { label: "Scroll", labelKey: "nav.scroll", path: "/docs/scroll", categoryMatch: "scroll" },
          { label: "Accessibility", labelKey: "nav.accessibility", path: "/docs/accessibility", categoryMatch: "accessibility" },
        ],
      },
      {
        label: "Methodology",
        labelKey: "nav.methodology",
        path: "/docs/architecture",
        children: [
          { label: "Architecture", labelKey: "nav.architecture", path: "/docs/architecture", categoryMatch: "architecture" },
          { label: "Design Tokens", labelKey: "nav.designTokens", path: "/docs/design-tokens", categoryMatch: "design-tokens" },
          { label: "Custom Properties", labelKey: "nav.customProperties", path: "/docs/custom-properties", categoryMatch: "custom-properties" },
          { label: "Design Principles", labelKey: "nav.designPrinciples", path: "/docs/design-principles", categoryMatch: "design-principles" },
        ],
      },
      { label: "Claude", labelKey: "nav.claude", path: "/docs/claude", categoryMatch: "claude" },
    ],
    // Localized header-nav labels (#203). `zudoDoc()` shallow-merges top-level
    // config fields only (`translations: userTranslations ?? defaultTranslations`
    // in @takazudo/zudo-doc/dist/config.js) — an override here REPLACES the
    // shipped table wholesale, so every locale spreads `defaultTranslations`
    // first to keep `nav.backToMenu`, the pager strings, the version-banner
    // strings, and the `de` locale alive. `nav.overview` / `nav.claude` reuse
    // the keys zudo-doc already ships (including a real `ja` translation for
    // `nav.overview`); every other `nav.*` key below is new for this site's
    // grouped nav. Every key must exist in BOTH locales — `t()` resolves
    // locale → default locale → the raw key itself
    // (dist/route-context/index.js), so a missing `ja` entry would render a
    // literal `nav.layout` in the header.
    translations: {
      ...defaultTranslations,
      en: {
        ...defaultTranslations.en,
        "nav.layout": "Layout",
        "nav.flexboxAndGrid": "Flexbox & Grid",
        "nav.positioning": "Positioning",
        "nav.sizing": "Sizing",
        "nav.media": "Media",
        "nav.documentLayout": "Document Layout",
        "nav.typography": "Typography",
        "nav.fontSizing": "Font Sizing",
        "nav.fonts": "Fonts",
        "nav.textControl": "Text Control",
        "nav.styling": "Styling",
        "nav.color": "Color",
        "nav.effects": "Effects",
        "nav.shadowsAndBorders": "Shadows & Borders",
        "nav.responsive": "Responsive",
        "nav.interactive": "Interactive",
        "nav.statesAndTransitions": "States & Transitions",
        "nav.selectors": "Selectors",
        "nav.scroll": "Scroll",
        "nav.accessibility": "Accessibility",
        "nav.methodology": "Methodology",
        "nav.architecture": "Architecture",
        "nav.designTokens": "Design Tokens",
        "nav.customProperties": "Custom Properties",
        "nav.designPrinciples": "Design Principles",
      },
      ja: {
        ...defaultTranslations.ja,
        // Each label matches the `title` / `sidebar_label` of the matching
        // src/content/docs-ja/<category>/index.mdx so the header and the page
        // it opens read the same (#204).
        "nav.layout": "レイアウト",
        "nav.flexboxAndGrid": "Flexbox & Grid",
        "nav.positioning": "ポジショニング",
        "nav.sizing": "サイジング",
        "nav.media": "メディア",
        "nav.documentLayout": "ドキュメントレイアウト",
        "nav.typography": "タイポグラフィ",
        "nav.fontSizing": "フォントサイズ",
        "nav.fonts": "フォント",
        "nav.textControl": "テキスト制御",
        "nav.styling": "スタイリング",
        "nav.color": "カラー",
        "nav.effects": "エフェクト",
        "nav.shadowsAndBorders": "シャドウ & ボーダー",
        "nav.responsive": "レスポンシブ",
        "nav.interactive": "インタラクティブ",
        "nav.statesAndTransitions": "ステート & トランジション",
        "nav.selectors": "セレクター",
        "nav.scroll": "スクロール",
        "nav.accessibility": "アクセシビリティ",
        "nav.methodology": "CSS設計",
        "nav.architecture": "アーキテクチャ",
        "nav.designTokens": "デザイントークン",
        "nav.customProperties": "カスタムプロパティ",
        "nav.designPrinciples": "デザイン原則",
      },
    },
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
