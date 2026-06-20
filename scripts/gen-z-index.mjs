#!/usr/bin/env node
// scripts/gen-z-index.mjs
//
// Codegen: rewrite the GENERATED:Z_INDEX marker block inside
// src/styles/global.css from the single source of truth in
// src/config/z-index-tokens.ts.
//
// The block is a Tailwind v4 `@theme { --z-index-<name>: <value>; }` for every
// tier, so Tailwind generates `z-<name>` utilities (e.g. `--z-index-toolbar: 20`
// → `.z-toolbar { z-index: 20 }`) and raw CSS can reference the same var via
// `z-index: var(--z-index-<name>)`.
//
// Pure Node (fs only — NO npm deps). Idempotent: running twice produces no diff.
//
// Usage:
//   node scripts/gen-z-index.mjs           # rewrite the block in global.css
//   node scripts/gen-z-index.mjs --check   # verify committed block is up to date
//                                          # (exit 1 on drift, no write)
//
// MAINTENANCE: edit src/config/z-index-tokens.ts (the source of truth), then run
// `pnpm gen:z-index` and commit the regenerated global.css. Never hand-edit the
// block between the BEGIN/END markers.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TOKENS_PATH = resolve(ROOT, "src/config/z-index-tokens.ts");
const CSS_PATH = resolve(ROOT, "src/styles/global.css");

const BEGIN_MARKER = "GENERATED:Z_INDEX_BEGIN";
const END_MARKER = "GENERATED:Z_INDEX_END";

/**
 * Parse the Z_INDEX_TIERS array out of z-index-tokens.ts WITHOUT importing it
 * (this script is a dependency-free .mjs and cannot resolve TypeScript). Reads
 * each `{ name: "...", value: <n>, ... }` object literal. Throws on a malformed
 * source so drift between the parser and the file surfaces loudly.
 */
function parseTiers(src) {
  const arrayMatch = src.match(
    /export const Z_INDEX_TIERS[^=]*=\s*\[([\s\S]*?)\];/,
  );
  if (!arrayMatch) {
    throw new Error(
      `Could not locate "export const Z_INDEX_TIERS = [ ... ]" in ${TOKENS_PATH}`,
    );
  }
  const body = arrayMatch[1];
  const tiers = [];
  // Each tier is a `{ ... }` object literal; iterate top-level braces.
  const objectRe = /\{([\s\S]*?)\}/g;
  let m;
  while ((m = objectRe.exec(body)) !== null) {
    const obj = m[1];
    const nameMatch = obj.match(/name:\s*"([^"]+)"/);
    const valueMatch = obj.match(/value:\s*(-?\d+)/);
    if (!nameMatch || !valueMatch) {
      throw new Error(
        `Malformed tier object in Z_INDEX_TIERS (missing name/value): ${obj.trim()}`,
      );
    }
    tiers.push({ name: nameMatch[1], value: Number(valueMatch[1]) });
  }
  if (tiers.length === 0) {
    throw new Error(`Z_INDEX_TIERS in ${TOKENS_PATH} parsed to an empty list`);
  }
  return tiers;
}

/**
 * Build the full generated block (markers included). Two leading spaces of
 * indentation match the surrounding `@theme` style in global.css.
 */
function buildBlock(tiers) {
  const lines = [];
  lines.push(`  /* ${BEGIN_MARKER}`);
  lines.push(
    `   * GENERATED:Z_INDEX — do not hand-edit; run pnpm gen:z-index.`,
  );
  lines.push(
    `   * Source of truth: src/config/z-index-tokens.ts. Tailwind v4 reads the`,
  );
  lines.push(
    `   * --z-index-<name> theme key and generates a z-<name> utility. */`,
  );
  lines.push(`  @theme {`);
  for (const tier of tiers) {
    lines.push(`    --z-index-${tier.name}: ${tier.value};`);
  }
  lines.push(`  }`);
  lines.push(`  /* ${END_MARKER} */`);
  return lines.join("\n");
}

/**
 * Replace the existing BEGIN…END block in `css` with `block`. Throws if the
 * markers are missing (the block must be seeded once by hand — see global.css).
 */
function replaceBlock(css, block) {
  const beginIdx = css.indexOf(BEGIN_MARKER);
  const endIdx = css.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${BEGIN_MARKER} … ${END_MARKER} markers in ${CSS_PATH}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  // Expand to the full comment line that opens the block ("  /* GENERATED:...")
  // and to the end of the closing "*/ " line so the whole region is replaced.
  const lineStart = css.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = css.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? css.length : afterEnd;
  return css.slice(0, lineStart) + block + css.slice(lineEnd);
}

function main() {
  const check = process.argv.includes("--check");

  const tokensSrc = readFileSync(TOKENS_PATH, "utf8");
  const css = readFileSync(CSS_PATH, "utf8");

  const tiers = parseTiers(tokensSrc);
  const block = buildBlock(tiers);
  const next = replaceBlock(css, block);

  if (check) {
    if (next !== css) {
      console.error(
        "z-index codegen drift detected: src/styles/global.css is out of date.",
      );
      console.error("Run `pnpm gen:z-index` and commit the result.");
      return 1;
    }
    console.log(
      `OK — z-index @theme block is up to date (${tiers.length} tiers).`,
    );
    return 0;
  }

  if (next === css) {
    console.log(
      `z-index @theme block already up to date (${tiers.length} tiers); no change.`,
    );
    return 0;
  }
  writeFileSync(CSS_PATH, next);
  console.log(
    `Wrote z-index @theme block to src/styles/global.css (${tiers.length} tiers).`,
  );
  return 0;
}

process.exit(main());
