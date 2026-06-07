// zfb plugin module: search-index.
//
// Wires two lifecycle hooks for the search-index integration:
//
//   postBuild — invokes `emitSearchIndex` to write `dist/search-index.json`.
//               There is no settings gate — the index is always emitted,
//               matching the legacy Astro behaviour.
//
//   devMiddleware — rebuilds the in-memory search index from disk on every
//               request so authoring edits surface without a dev-server
//               restart. Registered at `/search-index.json`.
//
// `options` carries `{ docsDir, locales, base }` from the matching entry
// in `zfb.config.ts`.
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitSearchIndex, createSearchIndexDevMiddleware } from "@takazudo/zudo-doc/integrations/search-index";
import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "search-index",

  postBuild(ctx) {
    const { docsDir, locales, base } = ctx.options;
    emitSearchIndex({
      outDir: ctx.outDir,
      docsDir,
      locales,
      base,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx) {
    const middleware = createSearchIndexDevMiddleware(ctx.options);
    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/search-index.json`, so we register
    // the full base-prefixed route. For base="/", the prefix is empty
    // and the route is `/search-index.json` as expected. The v2
    // middleware itself is base-tolerant (matches via
    // `endsWith("/search-index.json")`), so it does not need a
    // separate base-stripping pass.
    const basePrefix = stripTrailingSlash(ctx.options.base ?? "");
    ctx.register(`${basePrefix}/search-index.json`, connectToZfbHandler(middleware));
  },
};

function stripTrailingSlash(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
