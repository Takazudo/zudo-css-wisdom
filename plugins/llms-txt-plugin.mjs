// zfb plugin module: llms-txt.
//
// Wires two lifecycle hooks for the llms-txt integration:
//
//   postBuild — invokes `emitLlmsTxt` to write `dist/llms.txt`,
//               `dist/llms-full.txt`, and the per-locale variants.
//               `siteUrl` is normalised to `undefined` when falsy because
//               the runner switches between absolute and root-relative URLs
//               based on its presence (matches legacy Astro behaviour).
//
//   devMiddleware — serves `/llms.txt`, `/llms-full.txt`, and the per-locale
//               `/<code>/llms.txt` / `/<code>/llms-full.txt` variants from
//               the on-the-fly `generateLlmsTxt` generator so dev output
//               stays in lockstep with the production `emitLlmsTxt`
//               byte-for-byte.
//
// `options` carries `{ siteName, siteDescription, base, siteUrl,
// defaultLocaleDir, locales }` from the matching entry in `zfb.config.ts`.
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitLlmsTxt, createLlmsTxtDevMiddleware } from "@takazudo/zudo-doc/integrations/llms-txt";
import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "llms-txt",

  postBuild(ctx) {
    const {
      siteName,
      siteDescription,
      base,
      siteUrl,
      defaultLocaleDir,
      locales,
    } = ctx.options;
    emitLlmsTxt({
      outDir: ctx.outDir,
      siteName,
      siteDescription,
      base,
      siteUrl: siteUrl || undefined,
      defaultLocaleDir,
      locales,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx) {
    const middleware = createLlmsTxtDevMiddleware(ctx.options, ctx.logger);
    const handler = connectToZfbHandler(middleware);

    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/llms.txt` (etc.), so we register
    // every route with the base prefix. For base="/", the prefix is
    // empty and routes are `/llms.txt` etc. as expected. The middleware
    // accepts base-prefixed URLs via the matcher (see `matchLlmsRoute`
    // in `dev-middleware.ts`).
    const basePrefix = stripTrailingSlash(ctx.options.base ?? "");
    ctx.register(`${basePrefix}/llms.txt`, handler);
    ctx.register(`${basePrefix}/llms-full.txt`, handler);
    for (const locale of ctx.options.locales ?? []) {
      ctx.register(`${basePrefix}/${locale.code}/llms.txt`, handler);
      ctx.register(`${basePrefix}/${locale.code}/llms-full.txt`, handler);
    }
  },
};

function stripTrailingSlash(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
