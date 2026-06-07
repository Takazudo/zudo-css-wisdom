#!/usr/bin/env node
// Mirror the consumed @takazudo/zudo-doc package's compiled dist OUT of
// node_modules so Tailwind v4 can reliably scan it for class literals.
//
// WHY (this knowledge lives outside the codebase — it is the contract of a
// published package + a Tailwind-v4 quirk, recoverable from neither file):
//   @takazudo/zudo-doc ships NO precompiled CSS (`files: ["dist"]`). Its
//   component styles are static Tailwind class literals embedded in
//   dist/**/*.js (e.g. header.js: `class: "sticky top-0 z-50 ... bg-surface"`).
//   A CONSUMER must therefore generate those classes itself via a Tailwind
//   `@source` over the package files. But Tailwind v4's content scanner is
//   unreliable for paths under node_modules — it special-cases / ignores
//   node_modules even for an explicit `@source`, so package classes are
//   non-deterministically dropped from the built CSS (~28% missing in
//   practice: sticky-header offsets, dropdown shadows, spacing tokens, …).
//   Copying dist to a normal project path that Tailwind scans reliably, and
//   `@source`-ing THAT, keeps Tailwind itself as the source of truth (no
//   hand-maintained safelist that silently drifts) and is dep-bump-safe — the
//   mirror is re-derived from the installed dist on every run.
//   Root cause A of Takazudo/zudo-front-builder#884.
//
// The mirror dir (zudo-doc-tw-sources/) is gitignored — it is a build-time
// derivative of an installed dependency, never authored or committed.

import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIST = "node_modules/@takazudo/zudo-doc/dist";
const MIRROR_DIR = "zudo-doc-tw-sources";

/**
 * Mirror the package's dist .js/.mjs files into <projectRoot>/zudo-doc-tw-sources.
 * @param {string} projectRoot absolute path to the project root
 * @returns {number} count of files mirrored
 */
export function syncZudoDocClasses(projectRoot) {
  const src = join(projectRoot, PKG_DIST);
  const dest = join(projectRoot, MIRROR_DIR);

  if (!existsSync(src)) {
    throw new Error(
      `[sync-zudo-doc-classes] package dist not found at ${src} — run \`pnpm install\` first`,
    );
  }

  // Start clean so a removed/renamed package file never lingers in the mirror.
  rmSync(dest, { recursive: true, force: true });

  let count = 0;
  const copyTree = (fromDir, toDir) => {
    for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
      const from = join(fromDir, entry.name);
      const to = join(toDir, entry.name);
      if (entry.isDirectory()) {
        copyTree(from, to);
      } else if (/\.(js|mjs)$/.test(entry.name)) {
        mkdirSync(toDir, { recursive: true });
        cpSync(from, to);
        count++;
      }
    }
  };
  copyTree(src, dest);

  return count;
}

// CLI entry — used by the `predev` npm hook (the `preBuild` zfb plugin calls
// syncZudoDocClasses() directly). Runs from the project cwd.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const count = syncZudoDocClasses(projectRoot);
  console.log(`[sync-zudo-doc-classes] mirrored ${count} files → ${MIRROR_DIR}/`);
}
