/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Custom home route — deliberately NOT the scaffold-default locked 1-line
// re-export `export { default } from "@takazudo/zudo-doc/routes/index"`. That
// package route renders HomePageView WITHOUT `wide`, and zudo-doc 4.2.1 exposes
// no config toggle for the wide home grid, so the only way to match the
// zudo-doc showcase is to reconstruct the route here and pass `wide`. `wide`
// widens the content band from `max-width: 80rem` to `clamp(50rem, 92.5vw,
// 120rem)`, letting the category grid fill the viewport (~4 cols) instead of 3.
// Upstream request to add a config toggle so this host reconstruction is no
// longer needed: https://github.com/zudolab/zudo-doc/issues/2959
// Reconstruction mirrors the sanctioned self-contained pattern in
// pages/docs/[[...slug]].tsx (same package entrypoints, no pages/lib).

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

export default function IndexPage(): JSX.Element {
  const locale = routeCtx.defaultLocale;
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
