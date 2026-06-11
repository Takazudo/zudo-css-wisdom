// @ts-check
// zfb plugin module: copy-public.
//
// Workaround for upstream zfb gap — `zfb build` does not copy `public/`
// contents to `outDir`. See: zudolab/zudo-doc#1394;
// upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158
//
// postBuild — recursively copies `<projectRoot>/public/` directly into
//             `<outDir>/` (FLAT, matching zfb's own dist/ convention —
//             zfb emits dist/index.html, dist/assets/..., NOT
//             dist/<base>/index.html). Under the Workers static assets
//             deploy (base="/"), `dist/` is served at root directly by
//             `wrangler deploy` — no deploy-pipeline relocation step is
//             needed. The `base` option is intentionally unused here.
//
//             Example: `public/img/logo.svg` becomes `dist/img/logo.svg`,
//             served at `/img/logo.svg` by the Workers static asset layer.
//
// Missing or empty `public/` is treated as a no-op (no error).
//
// `options` carries `{ publicDir }` from the matching entry in
// `zfb.config.ts`. The `base` option is intentionally unused — see
// rationale above.

/** @import { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins" */

import { cp } from "node:fs/promises";
import { resolve } from "node:path";

/** @type {ZfbPlugin} */
export default {
  name: "copy-public",

  /** @param {ZfbBuildHookContext} ctx */
  async postBuild(ctx) {
    const { publicDir: publicDirOption } = ctx.options;
    const publicDir = resolve(
      ctx.projectRoot,
      typeof publicDirOption === "string" ? publicDirOption : "public",
    );
    const dest = ctx.outDir;

    ctx.logger.info(`copying ${publicDir} → ${dest}`);

    await cp(publicDir, dest, {
      recursive: true,
      force: true,
      errorOnExist: false,
    }).catch((/** @type {NodeJS.ErrnoException} */ err) => {
      if (err.code === "ENOENT") {
        // publicDir does not exist or is empty — treat as no-op.
        ctx.logger.info("public/ not found — skipping copy");
        return;
      }
      throw err;
    });
  },
};
