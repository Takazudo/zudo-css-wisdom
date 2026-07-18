/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locked manifest (#2653 Decision 4): a SELF-CONTAINED doc-route stub —
// REQUIRED because the injected DYNAMIC `/docs/[[...slug]]` route 404s in
// `zfb dev` (real pre-existing gap in zfb's dev-mode dynamic-route rendering,
// distinct from the `/`-injection gap zfb#1227; empirically confirmed on
// #2653). This stub reconstructs the doc route from scratch using ONLY the
// sanctioned package entrypoints — no `pages/lib`, no `@/config`:
//   1. the `virtual:zudo-doc-route-context` virtual module (serializable
//      settings/translations/tagVocabulary/colorSchemes payload),
//   2. `@takazudo/zudo-doc/route-context` (`createRouteContext`),
//   3. `@takazudo/zudo-doc/chrome` (`createChrome`), and
//   4. `virtual:zudo-doc-chrome-bindings` (the host-callables channel).
// The bindings import is unconditional: the routes plugin supplies an empty
// object when `chromeBindingsModule` is unset, while configured projects get
// their MDX/chrome bindings without editing this stub.
// Makes `/docs/getting-started/` return 200 in BOTH `zfb dev` and `zfb build`
// (see the "TM negative guard" case in route-injection-build.slow.test.ts for
// the no-stub 404 proof this fixes).
//
// docHistory note: when the docHistory feature is selected, the generator
// patches this file to statically import DocHistory from
// "@takazudo/zudo-doc/doc-history" and merge it over chromeBindings in
// createChrome's hostBindings (second) argument —
// DocHistory's chrome-derive default is a no-op stub (unlike
// DesignTokenPanelBootstrap, which the package auto-defaults), so without
// that patch the doc-history button never hydrates on this route.

import type { JSX } from "preact";
import { routeContext } from "virtual:zudo-doc-route-context";
import {
  createRouteContext,
  type RouteContextPayload,
} from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";

const ctx = routeContext as unknown as RouteContextPayload;
const routeCtx = createRouteContext(ctx);
const { renderDocPage } = createChrome(routeCtx, {
  ...chromeBindings,
  ...defineChromeBindings({ DocHistory }),
});

export const frontmatter = { title: "Docs" };

export function paths(): Array<{ params: { slug: string[] }; props: unknown }> {
  const locale = routeCtx.defaultLocale;
  const source = routeCtx.resolveNavSource(locale, undefined);
  return routeCtx.buildDocRouteEntries({
    source,
    locale,
    routeSig: `docs;${locale}`,
  }).map((item) => ({
    params: { slug: item.slugParams },
    props: item.props,
  }));
}

type PageArgs = { params: { slug: string[] } } & Record<string, unknown>;

export default function DocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props as never, {
    locale: routeCtx.defaultLocale,
    docHistoryContentDir: routeCtx.settings.docsDir,
  });
}
