/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host chrome adapter — THE single host adapter for the page-chrome surface
// (epic Collapse Wiring Shells #2420; HOSTCOLLAPSE #2427 collapsed the former
// per-component `pages/lib/_*` chrome shells into this one module).
//
// It builds the host's REAL bindings ONCE and threads them through the public
// `createChrome(routeContext, hostBindings)` builder, then re-exports the wired
// page-chrome barrel (renderDocPage, HeaderWithDefaults, FooterWithDefaults,
// HeadWithDefaults, composeMetaTitle, …). Every doc route + homepage chrome
// import resolves here.
//
//   - the reconstructed route context comes from the retained, vitest-safe
//     `./_route-context` seam (settings + i18n + URL/nav/slug helpers +
//     nav-source resolvers + route enumerators), fed the host content bridge
//     (`stableDocs`) so the content read + nav enumeration stay byte-identical;
//   - the genuinely host-bound slots (`hostBindings`): the real SearchWidget,
//     git-history manifest, sidebars config, frontmatter renderers/builder,
//     footer tag loader + vocabulary, body-end islands, DocHistory island, and
//     the showcase MDX content overrides (`mdxExtras`).
//
// Island-scanner contract (load-bearing): this module MUST keep the STATIC
// imports of DocHistory (`@takazudo/zudo-doc/doc-history`), BodyEndIslands
// (`./_body-end-islands`) and PresetGeneratorFallback (`./_preset-generator`).
// After the collapse the only page→island import chain is
// `pages/docs/*.tsx → _chrome.ts → {DocHistory, BodyEndIslands, PresetGenerator}`;
// if any of these became a type-only or dynamic import the zfb island scanner
// would stop walking it and the marker/bundle would silently drop.

import type { ComponentChildren } from "preact";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";

import { createChrome } from "@takazudo/zudo-doc/chrome";

import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import sidebars from "@/config/sidebars";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import type { DocsEntry } from "@/types/docs-entry";

import { routeContext } from "./_route-context";
import { stableDocs, memoizeDerived } from "./_nav-source-cache";
import { mergeLocaleDocs } from "./locale-merge";
import { SearchWidget } from "./_search-widget";
import { BodyEndIslands as BodyEndIslandsSeam } from "./_body-end-islands";
import { buildFrontmatterPreviewEntries } from "./_frontmatter-preview-data";
import { DetailsWrapper } from "./_details";
import { PresetGeneratorFallback } from "./_preset-generator";
// zcss-specific interactive demo islands (no template equivalent) — wired into
// the MDX bag below so the docs corpus's <CssPreview>/<TailwindPreview> tags
// resolve. The package's createMdxComponents spreads these `extras` last.
import { CssPreviewWrapper } from "./_css-preview";
import { TailwindPreviewWrapper } from "./_tailwind-preview";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
import { HtmlPreviewWrapper, type HtmlPreviewWrapperProps } from "@takazudo/zudo-doc/html-preview-wrapper";
// SSR author + date metadata — `#doc-history-meta` is the build-time manifest
// alias (esbuild-inlined, no fs). Static import is load-bearing for the island
// scanner chain noted above.
import docHistoryMeta from "#doc-history-meta";

// ---------------------------------------------------------------------------
// Footer tag loader (host-side; moved verbatim from the former
// _chrome-context.ts / _footer-with-defaults.tsx). Reads collections via
// stableDocs / memoizeDerived and aggregates tags per locale. Threaded as
// hostBindings.loadTagsForLocale.
// ---------------------------------------------------------------------------

function loadTagsForLocale(lang: string) {
  if (lang === defaultLocale) {
    const baseDocs = stableDocs("docs");
    return memoizeDerived([baseDocs], "footerTaglist;default", () => {
      const docs: DocsEntry[] = baseDocs.filter(
        (d) => !d.data.draft && !d.data.unlisted && !d.data.category_no_page,
      );
      const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
      return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
    });
  }
  const baseDocs = stableDocs("docs");
  const localeDocs = stableDocs(`docs-${lang}`);
  return memoizeDerived([baseDocs, localeDocs], `footerTaglist;${lang}`, () => {
    const result = mergeLocaleDocs({
      baseDocs: baseDocs.filter((d) => !d.data.draft),
      localeDocs: localeDocs.filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    const docs: DocsEntry[] = result.docs.filter((d) => !d.data.category_no_page);
    const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
    return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
  });
}

// ---------------------------------------------------------------------------
// Showcase MDX content overrides (host-bound; identical to the former
// pages/_mdx-components.ts `extras` block — kept in lockstep). Threaded via
// hostBindings.mdxExtras; the package factory merges them over its defaults.
// ---------------------------------------------------------------------------

/** MDX-tag stub: renders nothing (Preact null-vnode path). */
const MdxStub = (_props: unknown) => null;

/** SSR pass-through for `<Island when=…>` — renders children, ignores `when`. */
function IslandWrapper(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

const HtmlPreviewWithGlobalConfig = (props: HtmlPreviewWrapperProps) =>
  HtmlPreviewWrapper({ globalConfig: settings.htmlPreview ?? null, ...props });

const mdxExtras = {
  HtmlPreview: HtmlPreviewWithGlobalConfig,
  Details: DetailsWrapper,
  SmartBreak: MdxStub,
  Island: IslandWrapper,
  PresetGenerator: PresetGeneratorFallback,
  Avatar: MdxStub,
  Button: MdxStub,
  Card: MdxStub,
  MyComponent: MdxStub,
  PageLayout: MdxStub,
  // zcss-specific interactive demo islands (real wrappers; <Island when="visible">).
  CssPreview: CssPreviewWrapper,
  TailwindPreview: TailwindPreviewWrapper,
  // Pure showcase placeholders used only as illustrative examples in the zcss
  // MDX corpus — render nothing (no real component). Without a binding each
  // would 500 the SSR render of the page that references it.
  Badge: MdxStub,
  Dialog: MdxStub,
  MDXRemote: MdxStub,
  ProductCard: MdxStub,
  Teleport: MdxStub,
} as unknown as Record<string, (props: Record<string, unknown>) => unknown>;

// ---------------------------------------------------------------------------
// The host's real bindings (the 10 ChromeHostBindings slots).
// ---------------------------------------------------------------------------

const hostBindings: ChromeHostBindings = {
  SearchWidget: SearchWidget as ChromeHostBindings["SearchWidget"],
  docHistoryMeta: docHistoryMeta as Record<string, unknown>,
  sidebarsConfig: sidebars as unknown as Record<string, unknown>,
  frontmatterRenderers: frontmatterRenderers as unknown as ChromeHostBindings["frontmatterRenderers"],
  buildFrontmatterPreviewEntries:
    buildFrontmatterPreviewEntries as unknown as ChromeHostBindings["buildFrontmatterPreviewEntries"],
  loadTagsForLocale: loadTagsForLocale as unknown as ChromeHostBindings["loadTagsForLocale"],
  tagVocabulary,
  BodyEndIslands: BodyEndIslandsSeam as unknown as ChromeHostBindings["BodyEndIslands"],
  DocHistory: DocHistory as unknown as ChromeHostBindings["DocHistory"],
  mdxExtras: mdxExtras as ChromeHostBindings["mdxExtras"],
};

// ---------------------------------------------------------------------------
// Build the wired page-chrome surface ONCE from the route context + real host
// bindings, and re-export the barrel. Every omitted slot falls back to the
// package stub (byte-identical to the injected package-routes path); each REAL
// slot above overrides it.
// ---------------------------------------------------------------------------

const chrome = createChrome(routeContext, hostBindings);

export type { RenderDocPageOptions } from "@takazudo/zudo-doc/doc-page-renderer";

export const {
  composeMetaTitle,
  HeadWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  SidebarWithDefaults,
  renderDocPage,
  VersionsPageView,
  collectTagMapForLocale,
  TagDetailPageView,
  TagsIndexPageView,
  SiteTreeNavWrapper,
  BodyEndIslands,
} = chrome;
