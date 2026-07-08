export type {
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  TagVocabularyEntry,
  ChangelogConfig,
  MetaTagsConfig,
} from "./settings-types";
import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  ChangelogConfig,
  MetaTagsConfig,
} from "./settings-types";
import type { SiteHeadConfig } from "@takazudo/zudo-doc/settings";
export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  siteName: "zudo-css-wisdom",
  siteDescription: "Pragmatic CSS knowledge for AI" as string,
  base: "/",
  trailingSlash: false as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  githubUrl: "https://github.com/Takazudo/zudo-css-wisdom" as string | false,
  siteUrl: "https://zudo-css-wisdom.takazudomodular.com" as string,
  metaTags: {
    description: true,
    keywords: false,
    ogImage: "/img/ogp.png",
    ogSiteName: true,
    twitterCard: "summary_large_image",
    twitterCreator: "@Takazudo",
  } satisfies MetaTagsConfig as MetaTagsConfig,
  // Site webfont — Noto Sans JP for JA + Latin body text. Emitted as real <head>
  // links via the zudo-doc 2.0.1 `settings.head` hook (preconnect + async-loaded
  // stylesheet) — the supported way to add custom <head> content after the 2.0.0
  // chrome collapse. Replaces the former global.css @import, which Tailwind v4
  // bundling could push past the first style rule, making the browser silently
  // drop it (zudolab/zudo-doc#2435).
  head: {
    preconnect: [
      { href: "https://fonts.googleapis.com" },
      { href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
    ],
    stylesheets: [
      {
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
        async: true,
      },
    ],
  } satisfies SiteHeadConfig as SiteHeadConfig,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: false,
  sitemap: true,
  docMetainfo: true,
  docTags: false,
  tagPlacement: "after-title" as TagPlacement,
  tagGovernance: "off" as TagGovernanceMode,
  tagVocabulary: false as boolean,
  frontmatterPreview: false as FrontmatterPreviewConfig | false,
  llmsTxt: true,
  changelogs: false as ChangelogConfig[] | false,
  math: false,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: false as boolean,
  aiChatDemoMode: false as boolean,
  aiChatAllowedOrigins: [] as string[],
  aiChatGlobalDailyLimit: false as number | false,
  docHistory: true,
  bodyFootUtilArea: {
    docHistory: true,
    viewSourceLink: false,
  } satisfies BodyFootUtilAreaConfig as BodyFootUtilAreaConfig | false,
  designTokenPanel: false as boolean,
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",
  colorTweakPanel: false as boolean,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  imageEnlarge: true as boolean,
  dynamicPageTransition: false as boolean,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: false as VersionConfig[] | false,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
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
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
    { label: "Methodology", path: "/docs/methodology", categoryMatch: "methodology" },
    { label: "Layout", path: "/docs/layout", categoryMatch: "layout" },
    { label: "Typography", path: "/docs/typography", categoryMatch: "typography" },
    { label: "Styling", path: "/docs/styling", categoryMatch: "styling" },
    { label: "Responsive", path: "/docs/responsive", categoryMatch: "responsive" },
    { label: "Interactive", path: "/docs/interactive", categoryMatch: "interactive" },
    { label: "Claude", path: "/docs/claude", categoryMatch: "claude" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  headerRightItems: [
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  // Paths served only in the default locale (English) — no locale-prefixed
  // equivalents are built. These are the build-time-generated Claude resource
  // docs (gitignored, EN-only), so the language switcher hides locale options there.
  defaultLocaleOnlyPrefixes: [
    "/docs/claude-md/",
    "/docs/claude-skills/",
    "/docs/claude-commands/",
    "/docs/claude-agents/",
  ] as string[],
  // Enable the package-owned route-injection plugin (@takazudo/zudo-doc/plugins/routes):
  // the 3.x package supplies the docs / 404 / sitemap / robots / tags / versions routes
  // at build time, so the host no longer ships those page stubs. zudoDocPreset() does NO
  // defaulting — omitting this field is treated as off (routes would not be injected).
  packageOwnedRoutes: true,
};
