// zfb plugin module: sync-zudo-doc-classes.
//
// Runs the @takazudo/zudo-doc dist mirror (see
// scripts/sync-zudo-doc-classes.mjs for the full WHY) in zfb's `preBuild`
// lifecycle hook, so the mirror exists before Tailwind scans `@source`.
// preBuild fires for every `zfb build` invocation — CI, all Cloudflare
// deploy workflows, and `pnpm b4push` — so no build entry point can skip it.
// (Local `zfb dev` is additionally covered by the `predev` npm hook in
// package.json, belt-and-suspenders, since dev does not run a full build.)
//
// Inline functions are not supported by zfb's plugin runtime — the host
// imports this module by path. The mirror logic is plain-Node ESM, so unlike
// the claude-resources shim it can be imported directly (no tsx child needed).

import { syncZudoDocClasses } from "../scripts/sync-zudo-doc-classes.mjs";

const PLUGIN_NAME = "sync-zudo-doc-classes";

export default {
  name: PLUGIN_NAME,
  async preBuild(ctx) {
    const count = syncZudoDocClasses(ctx.projectRoot);
    ctx.logger.info(`sync-zudo-doc-classes: mirrored ${count} package dist files`);
  },
};
