/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locked manifest (#2653 Decision 4, i18n addendum): the locale-prefixed
// counterpart of pages/docs/[[...slug]].tsx — required for the same reason
// (injected DYNAMIC routes 404 in `zfb dev`). Self-contained: only the
// sanctioned package entrypoints — no `pages/lib`, no `@/config`. The
// `virtual:zudo-doc-chrome-bindings` import is unconditional, just like the
// default-locale stub: the routes plugin supplies `{}` when no host module is
// configured. Mirrors
// the package's own `routes/locale-docs-slug.tsx` shape, rebuilt from the
// route-context payload instead of the package-internal `_context.js`.
//
// Per-locale content dir + fallback notice (ported from
// packages/zudo-doc/src/routes/locale-docs-slug.tsx and the showcase's
// pages/[locale]/docs/[[...slug]].tsx): each route carries the locale's own
// content directory (`getLocaleConfig(locale).dir`) and an `isFallback` flag.
// A page that only exists in the default locale is served as an untranslated
// FALLBACK — it must (a) read doc-history from the DEFAULT-locale content dir
// (not the translated one, which has no such file), and (b) thread
// `isFallback` so the chrome renders the "not translated yet" notice. Dropping
// either — as this stub previously did by hardcoding `docsDir` for every
// locale and never passing `isFallback` — silently breaks translated pages.
//
// docHistory note: same as the default-locale stub — when docHistory is
// selected, the generator patches this file too.

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

export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: unknown;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: unknown;
  }> = [];

  for (const locale of Object.keys(routeCtx.settings.locales)) {
    const contentDir =
      routeCtx.getLocaleConfig(locale)?.dir ?? routeCtx.settings.docsDir;
    const source = routeCtx.resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    for (const item of routeCtx.buildDocRouteEntries({
      source,
      locale,
      routeSig: `locale-docs;${locale}`,
    })) {
      result.push({
        params: { locale, slug: item.slugParams },
        props: {
          ...(item.props as unknown as Record<string, unknown>),
          // Fallback pages exist only in the default locale, so their
          // doc-history lives under the EN docsDir; translated pages read
          // their own locale dir.
          contentDir: item.isFallback ? routeCtx.settings.docsDir : contentDir,
          isFallback: item.isFallback,
        },
      });
    }
  }

  return result;
}

type PageArgs = {
  params: { locale: string; slug: string[] };
  contentDir: string;
  isFallback: boolean;
} & Record<string, unknown>;

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props as never, {
    locale: props.params.locale,
    isFallback: props.isFallback,
    docHistoryContentDir: props.contentDir,
  });
}
