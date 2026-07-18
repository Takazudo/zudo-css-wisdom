// Host chrome bindings, consumed by the package-injected + host doc routes via
// the `virtual:zudo-doc-chrome-bindings` module (wired by `chromeBindingsModule`
// in zfb.config.ts). Only the two site-custom demo components need registering;
// admonitions, CodeGroup, nav, math, etc. are all package defaults.
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
import CssPreview from "./components/css-preview/css-preview";
import TailwindPreview from "./components/tailwind-preview/tailwind-preview";

export const chromeBindings = defineChromeBindings({
  mdxExtras: {
    CssPreview,
    TailwindPreview,
  },
});
