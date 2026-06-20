// @ts-check
// zfb plugin module: doc-history.
//
// Wires three lifecycle hooks for the doc-history integration:
//
//   preBuild  — emits `.zfb/doc-history-meta.json` (per-page git metadata
//               consumed at bundle time). Calls `runDocHistoryMetaStep`
//               directly; honours `SKIP_DOC_HISTORY=1` via the runner's
//               own env check.
//
//   postBuild — invokes `runDocHistoryPostBuild` to write
//               `<outDir>/doc-history/<slug>.json` files. Skipped by default
//               on local builds (opt in with `GEN_DOC_HISTORY=1`); always runs
//               in CI; `SKIP_DOC_HISTORY=1` suppresses it everywhere. The
//               gating lives in `shouldGeneratePostBuild` (#1986).
//
//   devMiddleware — reverse-proxies `/doc-history/*` requests to the
//               standalone `@takazudo/zudo-doc-history-server` on port 4322.
//
// Inline functions are not supported by zfb's plugin runtime — see
// `@takazudo/zfb/plugins` source comment. Plugins must be authored as
// standalone modules and referenced from `zfb.config.ts` by `name`.

/** @import { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbPlugin } from "@takazudo/zfb/plugins" */

import { runDocHistoryMetaStep } from "@takazudo/zudo-doc/integrations/doc-history";
import { runDocHistoryPostBuild } from "@takazudo/zudo-doc/integrations/doc-history";
import { createDocHistoryDevMiddleware } from "@takazudo/zudo-doc/integrations/doc-history";
import { connectToZfbHandler } from "./connect-adapter.mjs";

/** @type {ZfbPlugin} */
export default {
  name: "doc-history",

  /** @param {ZfbBuildHookContext} ctx */
  async preBuild(ctx) {
    const { docsDir, locales } = ctx.options;
    // Validate each locale entry before passing downstream so a misconfigured
    // locales map surfaces a clear error instead of a confusing runtime crash.
    if (locales != null) {
      for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (locales))) {
        if (
          entry == null ||
          typeof entry !== "object" ||
          typeof /** @type {any} */ (entry).dir !== "string" ||
          /** @type {any} */ (entry).dir.length === 0
        ) {
          throw new Error(
            `[doc-history] invalid locales entry "${key}": expected { dir: string }`,
          );
        }
      }
    }
    await runDocHistoryMetaStep({
      projectRoot: ctx.projectRoot,
      docsDir: typeof docsDir === "string" ? docsDir : "src/content/docs",
      locales:
        locales != null
          ? /** @type {Record<string,{dir:string}>} */ (locales)
          : undefined,
    });
  },

  /** @param {ZfbBuildHookContext} ctx */
  async postBuild(ctx) {
    try {
      await runDocHistoryPostBuild(
        /** @type {import("@takazudo/zudo-doc/integrations/doc-history").DocHistoryOptions} */ (/** @type {unknown} */ (ctx.options)),
        { outDir: ctx.outDir, logger: ctx.logger },
      );
    } catch (err) {
      // postBuild dropdown JSON is redundant: the parallel build-history CI job
      // is the deployed source of truth. Downgrade failures to a warning so a
      // transient git/CLI error does not red the build-site job.
      const msg = err instanceof Error ? err.message : String(err);
      if (ctx.logger?.warn) {
        ctx.logger.warn(`[doc-history] postBuild failed (non-fatal): ${msg}`);
      } else {
        console.warn(`[doc-history] postBuild failed (non-fatal): ${msg}`);
      }
    }
  },

  /** @param {ZfbDevMiddlewareContext} ctx */
  devMiddleware(ctx) {
    const middleware = createDocHistoryDevMiddleware(
      /** @type {import("@takazudo/zudo-doc/integrations/doc-history").DocHistoryOptions} */ (/** @type {unknown} */ (ctx.options)),
      ctx.logger,
    );
    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/doc-history/foo.json`, so we register
    // at the full base-prefixed route. For base="/", the prefix is empty
    // and the route is `/doc-history` as expected. The v2 middleware
    // itself is base-tolerant (matches via `url.includes("/doc-history/")`)
    // and slices from `/doc-history/` onward when proxying upstream.
    const basePrefix = stripTrailingSlash(
      typeof ctx.options["base"] === "string" ? ctx.options["base"] : "",
    );
    ctx.register(`${basePrefix}/doc-history`, connectToZfbHandler(middleware));
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
