// zfb plugin module: claude-resources.
//
// Wires `runClaudeResourcesPreStep` (from
// `@takazudo/zudo-doc/integrations/claude-resources`) into zfb's
// `preBuild` lifecycle hook. Replaces the npm `prebuild`-script glue
// in `scripts/zfb-prebuild.mjs` for this step (the script remains in
// place during the merge window — T6 retires it).
//
// Why this shim exists (and is not the v2 integration module directly):
//
//   1. zfb's plugin host runs `node` without any TypeScript loader, so
//      it cannot import `.ts` source files. The v2 integration package
//      (`@takazudo/zudo-doc/integrations/claude-resources`) currently
//      ships only TypeScript source through its `exports` map and has
//      no build step.
//
//   2. The `runClaudeResourcesPreStep` runner pulls in `gray-matter`,
//      which performs a CJS `require("fs")` that esbuild's
//      configuration-loader bundle (ESM-only) cannot satisfy. Loading
//      it inline at the top of `zfb.config.ts` therefore breaks config
//      parsing entirely.
//
// Both problems are solved by isolating the runner behind a child
// process: this shim spawns `tsx` (the project's existing TS-aware
// Node runner, pinned via `tsx` in `package.json`) on a tiny inline
// script that imports the runner. tsx handles `.ts` resolution and
// Node's CJS↔ESM interop for gray-matter; the parent plugin host stays
// in plain Node and only sees a child-process exit code.
//
// Inline functions are not supported by zfb's plugin runtime — see
// `@takazudo/zfb/plugins` source comment. This file is the plugin-host
// equivalent once the npm script is retired (T6).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PLUGIN_NAME = "@takazudo/zudo-doc-claude-resources";

// `tsx` is a workspace dependency of the host project and resolves to
// `<projectRoot>/node_modules/.bin/tsx` from this file. We resolve the
// binary explicitly so the shim does not depend on the parent shell's
// `PATH` (the plugin host is spawned by zfb without sourcing the
// user's profile — Node's `PATH` is whatever zfb itself was launched
// with).
const HERE = dirname(fileURLToPath(import.meta.url));
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");

/**
 * Run the v2 claude-resources runner under tsx.
 *
 * Inlines a minimal ESM script via `tsx -e` so we don't have to ship a
 * second `.ts` file just to host the call site. The runner returns a
 * `{ claudemd, commands, skills, agents }` summary which we re-emit on
 * the child's stdout — the parent (this shim) parses it and forwards
 * the summary to the plugin host's logger.
 */
function runRunnerUnderTsx({ claudeDir, projectRoot, docsDir }) {
  // The runner accepts `projectRoot` and `docsDir` as relative paths
  // (resolved against `process.cwd()` in the runner). To insulate the
  // child from whatever cwd zfb spawned us with, we set cwd explicitly
  // and pass absolute paths through.
  // tsx's `-e` flag emits CJS by default (it picks the format from the
  // entry's extension, and an inline `-e` script has none), so we wrap
  // the body in an `async`-IIFE rather than relying on top-level await.
  const childScript = `
    (async () => {
      const { runClaudeResourcesPreStep } = await import("@takazudo/zudo-doc/integrations/claude-resources");
      const result = await runClaudeResourcesPreStep({
        claudeDir: ${JSON.stringify(claudeDir)},
        projectRoot: ${JSON.stringify(projectRoot)},
        docsDir: ${JSON.stringify(docsDir)},
      });
      process.stdout.write(JSON.stringify(result));
    })().catch((err) => {
      process.stderr.write(err && err.stack ? err.stack : String(err));
      process.exit(1);
    });
  `;

  return new Promise((resolveCall, reject) => {
    const child = spawn(TSX_BIN, ["-e", childScript], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `[${PLUGIN_NAME}] runner exited with code ${code}\n${stderr}`,
          ),
        );
        return;
      }
      try {
        resolveCall(JSON.parse(stdout));
      } catch (err) {
        reject(
          new Error(
            `[${PLUGIN_NAME}] failed to parse runner stdout: ${err.message}\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      }
    });
  });
}

export default {
  name: PLUGIN_NAME,
  async preBuild(ctx) {
    const claudeDir = ctx.options.claudeDir;
    if (typeof claudeDir !== "string" || claudeDir.length === 0) {
      throw new Error(
        `[${PLUGIN_NAME}] preBuild: options.claudeDir must be a non-empty string (got ${JSON.stringify(claudeDir)})`,
      );
    }
    const projectRootOpt = ctx.options.projectRoot;
    const docsDirOpt = ctx.options.docsDir;
    const result = await runRunnerUnderTsx({
      claudeDir,
      projectRoot:
        typeof projectRootOpt === "string" ? projectRootOpt : ctx.projectRoot,
      docsDir: typeof docsDirOpt === "string" ? docsDirOpt : "src/content/docs",
    });
    // Surface a one-line summary so build logs make the migration
    // observable (mirrors the `[zfb-prebuild]` lines from the legacy
    // npm-script glue).
    ctx.logger.info(
      `claude-resources: ${result.claudemd} CLAUDE.md, ${result.commands} commands, ${result.skills} skills, ${result.agents} agents`,
    );
  },
};
