// @ts-check
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

/** @import { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbPlugin } from "@takazudo/zfb/plugins" */
/** @import { LlmsTxtEmitOptions, LlmsTxtDevMiddlewareOptions } from "@takazudo/zudo-doc/integrations/llms-txt" */

import { emitLlmsTxt, createLlmsTxtDevMiddleware } from "@takazudo/zudo-doc/integrations/llms-txt";
import { connectToZfbHandler } from "./connect-adapter.mjs";

/** @type {ZfbPlugin} */
export default {
  name: "llms-txt",

  /** @param {ZfbBuildHookContext} ctx */
  async postBuild(ctx) {
    await emitLlmsTxt(/** @type {LlmsTxtEmitOptions} */ (/** @type {unknown} */ ({
      ...ctx.options,
      outDir: ctx.outDir,
      // siteUrl is normalised to undefined when falsy because the runner
      // switches between absolute and root-relative URLs based on its
      // presence (matches legacy Astro behaviour).
      siteUrl: ctx.options["siteUrl"] || undefined,
      logger: ctx.logger,
    })));
  },

  /** @param {ZfbDevMiddlewareContext} ctx */
  devMiddleware(ctx) {
    const middleware = createLlmsTxtDevMiddleware(
      /** @type {LlmsTxtDevMiddlewareOptions} */ (/** @type {unknown} */ (ctx.options)),
      ctx.logger,
    );
    const handler = connectToZfbHandler(middleware);

    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/llms.txt` (etc.), so we register
    // every route with the base prefix. For base="/", the prefix is
    // empty and routes are `/llms.txt` etc. as expected. The middleware
    // accepts base-prefixed URLs via the matcher (see `matchLlmsRoute`
    // in `dev-middleware.ts`).
    const basePrefix = stripTrailingSlash(
      typeof ctx.options["base"] === "string" ? ctx.options["base"] : "",
    );
    ctx.register(`${basePrefix}/llms.txt`, handler);
    ctx.register(`${basePrefix}/llms-full.txt`, handler);
    const locales = ctx.options["locales"];
    if (Array.isArray(locales)) {
      for (const locale of locales) {
        if (locale && typeof locale === "object" && typeof locale.code === "string") {
          ctx.register(`${basePrefix}/${locale.code}/llms.txt`, handler);
          ctx.register(`${basePrefix}/${locale.code}/llms-full.txt`, handler);
        } else {
          const repr = JSON.stringify(locale);
          if (ctx.logger?.warn) {
            ctx.logger.warn(`[llms-txt] skipping malformed locale entry (expected { code: string }): ${repr}`);
          } else {
            console.warn(`[llms-txt] skipping malformed locale entry (expected { code: string }): ${repr}`);
          }
        }
      }
    }
  },
};

/**
 * @param {string} s
 * @returns {string}
 */
function stripTrailingSlash(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
