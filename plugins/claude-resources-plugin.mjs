// @ts-check
// zfb plugin module: claude-resources.
//
// Wires `runClaudeResourcesPreStep` (from
// `@takazudo/zudo-doc/integrations/claude-resources`) into zfb's
// `preBuild` lifecycle hook.
//
// Previously this shim spawned a `tsx` subprocess because the integration
// package shipped only TypeScript source (no build step) and `gray-matter`
// pulled in a CJS `require("fs")` that esbuild's ESM-only config-loader
// bundle could not satisfy. Both constraints are now lifted: the package
// ships compiled `dist/` and the plugin host is plain Node (not an esbuild
// bundle), so the runner can be imported directly.

/** @import { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins" */

import { runClaudeResourcesPreStep } from "@takazudo/zudo-doc/integrations/claude-resources";

const PLUGIN_NAME = "@takazudo/zudo-doc-claude-resources";

/** @type {ZfbPlugin} */
export default {
  name: PLUGIN_NAME,

  /** @param {ZfbBuildHookContext} ctx */
  async preBuild(ctx) {
    const claudeDir = ctx.options["claudeDir"];
    if (typeof claudeDir !== "string" || claudeDir.length === 0) {
      throw new Error(
        `[${PLUGIN_NAME}] preBuild: options.claudeDir must be a non-empty string (got ${JSON.stringify(claudeDir)})`,
      );
    }
    const projectRootOpt = ctx.options["projectRoot"];
    const docsDirOpt = ctx.options["docsDir"];
    const result = await runClaudeResourcesPreStep({
      claudeDir,
      projectRoot:
        typeof projectRootOpt === "string" ? projectRootOpt : ctx.projectRoot,
      docsDir: typeof docsDirOpt === "string" ? docsDirOpt : "src/content/docs",
    });
    // Surface a one-line summary so build logs make the generation
    // observable.
    ctx.logger.info(
      `claude-resources: ${result.claudemd} CLAUDE.md, ${result.commands} commands, ${result.skills} skills, ${result.agents} agents`,
    );
  },
};
