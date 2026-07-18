/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Custom locale-home route overriding the plugin-injected `/[locale]` route
// (@takazudo/zudo-doc/routes/locale-index, injected in the package's routes
// plugin). Same reason as pages/index.tsx: the package route renders
// HomePageView WITHOUT `wide` and zudo-doc 4.2.1 has no config toggle, so
// without this override the JA home (/ja) stays narrow (3 cols) while the EN
// home is wide — breaking EN/JA parity. `wide` widens the content band from
// `max-width: 80rem` to `clamp(50rem, 92.5vw, 120rem)`.
// Upstream request: https://github.com/zudolab/zudo-doc/issues/2959
// Host pages override plugin-injected routes — precedent in this repo:
// pages/[locale]/docs/[[...slug]].tsx overrides /[locale]/docs/[[...slug]].
// Self-contained reconstruction (no pages/lib), mirroring pages/docs/[[...slug]].tsx.

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
import { prepareHomeData } from "@takazudo/zudo-doc/home-page";

const ctx = routeContext as unknown as RouteContextPayload;
const routeCtx = createRouteContext(ctx);
const { HomePageView } = createChrome(routeCtx, {
  ...chromeBindings,
  ...defineChromeBindings({ DocHistory }),
});

export const frontmatter = { title: "Home" };

export function paths(): Array<{
  params: { locale: string };
  props: { locale: string };
}> {
  return Object.keys(routeCtx.settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

type PageArgs = { params: { locale: string } } & Record<string, unknown>;

export default function LocaleIndexPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;
  const { tree, categoryOrder, tagCount } = prepareHomeData(routeCtx, locale);
  return (
    <HomePageView
      locale={locale}
      tree={tree}
      categoryOrder={categoryOrder}
      tagCount={tagCount}
      wide
    />
  );
}
