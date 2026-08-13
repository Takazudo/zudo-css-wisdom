#!/usr/bin/env node

/**
 * normalize-extensionless-links.mjs — one-off migration helper (epic #196, sub-issue #198)
 *
 * Rewrites every extensionless relative doc link (e.g. `](./css-modules-strategy)`,
 * `](../tight-token-strategy/)`) to the repo's canonical `./target.mdx` / `../category/target.mdx`
 * form, BEFORE the category move runs, so restructure-docs.mjs's ordinary .mdx-link rewriter
 * (which already dry-run-verifies to 0 unresolved links) can carry them through the move like
 * every other link.
 *
 * Resolution rule (empirically derived + verified against pnpm build's rendered <a href> output
 * for all 99 occurrences, see PR description / issue #198 for the derivation): the site's
 * markdown-link resolver tries the naive `../`-climb target first; if no file exists there, it
 * backs off one climbed level at a time (down to the same directory) until it finds a target
 * that exists. This is NOT plain dirname arithmetic -- see resolveExistenceBased below.
 *
 * Run once, by hand, before `restructure-docs.mjs --apply`. Not wired into package.json; not
 * meant to be kept.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import posix from "node:path/posix";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const LOCALES = [
  { code: "en", relRoot: "src/content/docs" },
  { code: "ja", relRoot: "src/content/docs-ja" },
];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const EXTENSIONLESS_LINK_RE = /\]\((\.\.?\/[^)#\s]+)(#[^)\s]*)?\)/g;

async function walkMdx(absDir, baseAbsDir, out = []) {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) await walkMdx(full, baseAbsDir, out);
    else if (entry.name.endsWith(".mdx")) out.push(path.relative(baseAbsDir, full).split(path.sep).join("/"));
  }
  return out;
}

function withDotSlash(relLink) {
  if (relLink === "") return "./";
  return relLink.startsWith(".") ? relLink : `./${relLink}`;
}

/**
 * Resolve an extensionless relative link target to the docs-relative path (with extension /
 * index.mdx) it currently refers to, using the site's actual existence-based fallback algorithm:
 * try the full `../`-climb first, then back off one level at a time until an existing file
 * matches. `./x` and a single `../x` both mean "look in my own directory first" (climb 0),
 * consistent with climb-then-back-off since 1 climbed level backing off to 0 is the same rule.
 */
function resolveExistenceBased(sourceRel, rawTarget, existingSet) {
  const sourceDir = posix.dirname(sourceRel);
  let t = rawTarget.replace(/\/$/, "");
  let rem, maxN;
  if (t.startsWith("./")) {
    rem = t.slice(2);
    maxN = 0;
  } else {
    rem = t;
    let n = 0;
    while (rem.startsWith("../")) {
      rem = rem.slice(3);
      n++;
    }
    maxN = n;
  }
  const segs = sourceDir === "" ? [] : sourceDir.split("/");
  for (let k = maxN; k >= 0; k--) {
    const climbed = Math.min(k, segs.length);
    const base = segs.slice(0, segs.length - climbed).join("/");
    const candidate = base ? `${base}/${rem}` : rem;
    if (existingSet.has(`${candidate}.mdx`)) return `${candidate}.mdx`;
    if (existingSet.has(`${candidate}/index.mdx`)) return `${candidate}/index.mdx`;
  }
  return null;
}

async function main() {
  let totalRewritten = 0;
  let totalUnresolved = 0;

  for (const locale of LOCALES) {
    const absRoot = path.join(ROOT, locale.relRoot);
    const allFiles = await walkMdx(absRoot, absRoot);
    const existingSet = new Set(allFiles);

    for (const sourceRel of allFiles) {
      if (sourceRel.startsWith("claude-skills/")) continue; // out of scope of the restructure
      const absPath = path.join(absRoot, sourceRel);
      const content = await readFile(absPath, "utf-8");
      const sourceDir = posix.dirname(sourceRel);

      let changed = false;
      const newContent = content.replace(EXTENSIONLESS_LINK_RE, (full, rawTarget, anchor = "") => {
        if (rawTarget.endsWith(".mdx")) return full; // already normalized, not our concern
        const lastSeg = posix.basename(rawTarget.replace(/\/$/, ""));
        if (lastSeg.includes(".")) return full; // e.g. "../diagram.png" -- not a doc link

        const resolved = resolveExistenceBased(sourceRel, rawTarget, existingSet);
        if (!resolved) {
          console.error(`  UNRESOLVED [${locale.code}] ${sourceRel} -> ${rawTarget}`);
          totalUnresolved++;
          return full;
        }
        const relLink = withDotSlash(posix.relative(sourceDir, resolved));
        totalRewritten++;
        changed = true;
        return `](${relLink}${anchor})`;
      });

      if (changed && APPLY) {
        await writeFile(absPath, newContent, "utf-8");
      }
    }
  }

  console.log(`\n${APPLY ? "Rewrote" : "Would rewrite"} ${totalRewritten} extensionless links. Unresolved: ${totalUnresolved}.`);
  if (totalUnresolved > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
