#!/usr/bin/env node

/**
 * restructure-docs.mjs — Flat Category Restructure migration runner (epic #196, sub-issue #197)
 *
 * Reads scripts/path-migrations.json (the permanent old->new move manifest) and:
 *   1. `git mv`s every manifest file (EN + derived JA) into its new top-level category dir.
 *   2. Rewrites every relative `.mdx` link (`](./x.mdx)`, `](../y/z.mdx#anchor)`) in EN and JA,
 *      recomputed from each file's new location.
 *   3. Rewrites absolute internal doc links (`](/docs/...)`, `](/ja/docs/...)`).
 *   4. Rewrites `<CategoryNav category="old/path" />` -> `<CategoryNav category="new-path" />`
 *      wherever an old category directory maps unambiguously onto a surviving new one.
 *   5. Renumbers `sidebar_position` in three independent scopes (see renumberPositions below).
 *   6. Prints a reconciliation report (moved / rewritten / unresolved-links / renumbered).
 *
 * Usage:
 *   node scripts/restructure-docs.mjs              # dry run (default) — no filesystem writes
 *   node scripts/restructure-docs.mjs --dry-run     # same, explicit
 *   node scripts/restructure-docs.mjs --apply       # perform the moves + rewrites for real
 *
 * The dry run fully simulates every rewrite in memory (it reads current file content and
 * computes what the post-move content and post-move link targets would be) so its
 * "0 unresolved links" claim is a real check, not a vacuous one.
 *
 * SCOPE NOTE: this script only touches the 94 files listed in path-migrations.json's `moves`
 * array (92 articles + 2 deep-article index files). It deliberately does NOT move the ~19 other
 * old mid-level category index.mdx files (e.g. layout/positioning/index.mdx) or delete the 7
 * disappearing umbrella/junk-drawer routes recorded in `deletedRoutes` — those are handled by a
 * later wave (#198 for the cutover + nav, #199 for freshly-authored category index pages).
 *
 * LINK SCOPE NOTE: relative doc links WITHOUT a `.mdx` extension (e.g. `](./css-modules-strategy)`,
 * `](../tight-token-strategy/)`) are detected and reported in `extensionlessLinksNeedingManualReview`
 * but NOT rewritten — see the comment on EXTENSIONLESS_RELATIVE_LINK_RE for why (their resolution
 * doesn't follow simple dirname arithmetic and isn't safe to reverse-engineer here).
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import posix from "node:path/posix";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "scripts", "path-migrations.json");

const LOCALES = [
  { code: "en", relRoot: "src/content/docs", routePrefix: "/docs/" },
  { code: "ja", relRoot: "src/content/docs-ja", routePrefix: "/ja/docs/" },
];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
// --dry-run is the default; --apply is the only thing that turns it off.
const DRY_RUN = !APPLY;
const jsonFlagIndex = args.indexOf("--json");
const JSON_OUT = jsonFlagIndex !== -1 ? args[jsonFlagIndex + 1] : null;

// --- small path helpers (all "rel" paths below are docs-relative, POSIX-separated, no locale prefix) ---

function toPosixRel(p) {
  return p.split(path.sep).join("/");
}

function withDotSlash(relLink) {
  // Match the project's existing convention of a leading "./" for same-dir links
  // (posix.relative() never adds it; ".." links are left as-is).
  if (relLink === "") return "./";
  return relLink.startsWith(".") ? relLink : `./${relLink}`;
}

async function walkMdx(absDir, baseAbsDir, out = []) {
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await walkMdx(full, baseAbsDir, out);
    } else if (entry.name.endsWith(".mdx")) {
      out.push(toPosixRel(path.relative(baseAbsDir, full)));
    }
  }
  return out;
}

// --- manifest loading ---

async function loadManifest() {
  const raw = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
  const movesMap = new Map(); // oldRel -> newCategory
  for (const { old, newCategory } of raw.moves) {
    movesMap.set(old, newCategory);
  }
  return { raw, movesMap };
}

function newRelPathFor(oldRel, movesMap) {
  const newCategory = movesMap.get(oldRel);
  if (!newCategory) return oldRel; // stationary file, unchanged in this wave
  return `${newCategory}/${posix.basename(oldRel)}`;
}

// --- inventory: every .mdx file that exists today, per locale, plus its computed new location ---

async function buildInventory(movesMap) {
  /** @type {Map<string, {absOld: Map<string,string>, newRel: string, moved: boolean}>} */
  const inventory = new Map(); // key: oldRel (shared across locales) -> per-locale abs paths + new rel
  const perLocaleRel = new Map();

  for (const locale of LOCALES) {
    const absRoot = path.join(ROOT, locale.relRoot);
    const rels = await walkMdx(absRoot, absRoot);
    perLocaleRel.set(locale.code, new Set(rels));
  }

  // Mirror check: EN and JA relPath sets should be identical (project invariant).
  const enSet = perLocaleRel.get("en");
  const jaSet = perLocaleRel.get("ja");
  const onlyEn = [...enSet].filter((r) => !jaSet.has(r)).sort();
  const onlyJa = [...jaSet].filter((r) => !enSet.has(r)).sort();

  const allRels = new Set([...enSet, ...jaSet]);
  for (const rel of allRels) {
    const newRel = newRelPathFor(rel, movesMap);
    // `inScope`: this rel is one of the manifest's move entries (its category/position is being
    // migrated), regardless of whether the path text actually changes. `moved`: the physical
    // path differs, so a real `git mv` is needed (a handful of manifest entries — e.g. articles
    // already living directly under `responsive/` or `overview/` — resolve to their own current
    // path, since those top-level categories are unchanged by the restructure).
    inventory.set(rel, { newRel, inScope: movesMap.has(rel), moved: newRel !== rel });
  }

  return { inventory, onlyEn, onlyJa, perLocaleRel };
}

// --- collision check: two old files landing on the same new path ---

function findCollisions(inventory) {
  const byNewRel = new Map();
  for (const [oldRel, { newRel }] of inventory) {
    if (!byNewRel.has(newRel)) byNewRel.set(newRel, []);
    byNewRel.get(newRel).push(oldRel);
  }
  const collisions = [];
  for (const [newRel, olds] of byNewRel) {
    if (olds.length > 1) collisions.push({ newRel, olds });
  }
  return collisions;
}

// --- link rewriting ---

const RELATIVE_LINK_RE = /\]\((\.\.?\/[^)#\s]+\.mdx)(#[^)\s]*)?\)/g;
const ABSOLUTE_LINK_RE = /\]\((\/(?:ja\/)?docs\/[^)#\s]*)(#[^)\s]*)?\)/g;

// Any relative doc link that does NOT end in ".mdx" — e.g. `](./css-modules-strategy)`,
// `](../tight-token-strategy/)`. A codex-review pass on this file (P1) flagged these as silently
// skipped by RELATIVE_LINK_RE. They are real and reasonably common (~40 in EN, mirrored in JA),
// but this script deliberately does NOT rewrite them: built-HTML inspection of the *current*,
// unmigrated site shows zfb-md-wasm's markdown-link resolver does NOT resolve them via simple
// dirname-based path arithmetic — e.g. `../tight-token-strategy/` written in
// `methodology/design-systems/two-tier-size-strategy.mdx` (dirname
// "methodology/design-systems") renders as `/docs/methodology/design-systems/tight-token-strategy/`,
// not the naive `/docs/methodology/tight-token-strategy/` an extra ".." implies — while a
// same-directory link like `./css-modules-strategy` in a sibling file DOES resolve via plain
// dirname arithmetic. The resolver's real algorithm isn't documented and isn't safe to
// reverse-engineer here: replicating it wrong would let `--apply` silently corrupt links that
// work today. These are surfaced in the report as `extensionlessLinksNeedingManualReview`
// instead — verify each by hand after `--apply` (rendered `<a href>` in `pnpm build`'s dist/
// output is the ground truth, as demonstrated above).
const EXTENSIONLESS_RELATIVE_LINK_RE = /\]\((\.\.?\/[^)#\s]+)(#[^)\s]*)?\)/g;

function findExtensionlessRelativeLinks(content, sourceRel) {
  const found = [];
  for (const match of content.matchAll(EXTENSIONLESS_RELATIVE_LINK_RE)) {
    const [, rawTarget] = match;
    if (rawTarget.endsWith(".mdx")) continue;
    const lastSegment = posix.basename(rawTarget.replace(/\/$/, ""));
    if (lastSegment.includes(".")) continue; // e.g. "../diagram.png" — not a doc link
    found.push({ sourceRel, rawTarget });
  }
  return found;
}

/**
 * Resolve a route (no locale prefix, may or may not have a trailing slash) to the docs-relative
 * file it refers to. Tries "<route>.mdx" (article) then "<route>/index.mdx" (category/deep
 * index) — used only for ABSOLUTE /docs/... links, which are unambiguous (no dirname arithmetic
 * involved), unlike the extensionless RELATIVE links discussed above.
 */
function resolveDocRoute(route, inventory) {
  const hadTrailingSlash = route.endsWith("/");
  const bare = route.replace(/\/$/, "");
  const asIndex = `${bare}/index.mdx`;
  const asArticle = `${bare}.mdx`;
  const first = hadTrailingSlash ? asIndex : asArticle;
  const second = hadTrailingSlash ? asArticle : asIndex;
  return inventory.has(first) ? first : inventory.has(second) ? second : null;
}

/**
 * Resolve a relative link target (as written in `sourceRel`'s file) to a docs-relative path.
 */
function resolveRelativeTarget(sourceRel, rawTarget) {
  const sourceDir = posix.dirname(sourceRel);
  return posix.normalize(posix.join(sourceDir, rawTarget));
}

/**
 * Rewrite every relative .mdx link in `content` (a file currently at `sourceRel`) to point at
 * post-move locations. Returns { content, changes, unresolved }.
 */
function rewriteRelativeLinks(content, sourceRel, inventory) {
  const changes = [];
  const unresolved = [];
  const sourceNewRel = inventory.get(sourceRel)?.newRel ?? sourceRel;
  const newSourceDir = posix.dirname(sourceNewRel);

  const newContent = content.replace(RELATIVE_LINK_RE, (full, rawTarget, anchor = "") => {
    const targetRel = resolveRelativeTarget(sourceRel, rawTarget);
    const targetInfo = inventory.get(targetRel);
    if (!targetInfo) {
      unresolved.push({ sourceRel, rawTarget: rawTarget + anchor, resolvedTarget: targetRel, reason: "target file does not exist" });
      return full;
    }
    const newRelLink = withDotSlash(posix.relative(newSourceDir, targetInfo.newRel));
    const replacement = `](${newRelLink}${anchor})`;
    if (replacement !== full) {
      changes.push({ sourceRel, from: full, to: replacement });
    }
    return replacement;
  });

  return { content: newContent, changes, unresolved };
}

/**
 * Rewrite every absolute /docs/... or /ja/docs/... internal link.
 */
function rewriteAbsoluteLinks(content, sourceRel, inventory) {
  const changes = [];
  const unresolved = [];

  const newContent = content.replace(ABSOLUTE_LINK_RE, (full, routePath, anchor = "") => {
    const m = routePath.match(/^\/(ja\/)?docs\/(.*)$/);
    const localePrefix = m[1] ?? "";
    const route = m[2]; // e.g. "styling/color/three-tier-color-strategy" or ".../tight-token-strategy/"
    const hadTrailingSlash = route.endsWith("/");

    const targetRel = resolveDocRoute(route, inventory);
    if (!targetRel) {
      unresolved.push({ sourceRel, rawTarget: full, resolvedTarget: route.replace(/\/$/, ""), reason: "absolute link target does not exist" });
      return full;
    }

    const targetInfo = inventory.get(targetRel);
    const isIndex = posix.basename(targetInfo.newRel) === "index.mdx";
    const newRouteBase = isIndex
      ? posix.dirname(targetInfo.newRel)
      : posix.join(posix.dirname(targetInfo.newRel), posix.basename(targetInfo.newRel, ".mdx"));
    const newRoute = `/${localePrefix}docs/${newRouteBase}${hadTrailingSlash || isIndex ? "/" : ""}`;
    const replacement = `](${newRoute}${anchor})`;
    if (replacement !== full) {
      changes.push({ sourceRel, from: full, to: replacement });
    }
    return replacement;
  });

  return { content: newContent, changes, unresolved };
}

// --- CategoryNav rewriting ---

const CATEGORY_NAV_RE = /(<CategoryNav\s+category=")([^"]+)("\s*\/>)/g;

/**
 * Derive an old-category-dir -> new-category-dir map from the manifest: for every distinct
 * dirname(old) among the moves, take the most common newCategory among files in that exact
 * directory (a directory's articles usually all land in the same new category; where they
 * fan out — e.g. layout/sizing splits into "sizing" and "media" — the majority destination is
 * the directory's own successor). Directories in `deletedRoutes` are excluded: they have no
 * single successor and their CategoryNav tags die with the file (not moved by this script).
 */
function deriveCategoryDirMap(manifest) {
  const deleted = new Set(manifest.raw.deletedRoutes.map((r) => r.oldCategory));
  const counts = new Map(); // oldDir -> Map(newCategory -> count)
  for (const { old, newCategory } of manifest.raw.moves) {
    const oldDir = posix.dirname(old);
    if (!counts.has(oldDir)) counts.set(oldDir, new Map());
    const m = counts.get(oldDir);
    m.set(newCategory, (m.get(newCategory) ?? 0) + 1);
  }
  const dirMap = new Map();
  for (const [oldDir, freq] of counts) {
    if (deleted.has(oldDir)) continue;
    let best = null;
    let bestCount = -1;
    for (const [newCategory, count] of freq) {
      if (count > bestCount) {
        best = newCategory;
        bestCount = count;
      }
    }
    if (best) dirMap.set(oldDir, best);
  }
  return dirMap;
}

function rewriteCategoryNav(content, sourceRel, categoryDirMap) {
  const changes = [];
  const newContent = content.replace(CATEGORY_NAV_RE, (full, pre, oldCategory, post) => {
    const newCategory = categoryDirMap.get(oldCategory);
    if (!newCategory || newCategory === oldCategory) return full;
    changes.push({ sourceRel, from: oldCategory, to: newCategory });
    return `${pre}${newCategory}${post}`;
  });
  return { content: newContent, changes };
}

// --- sidebar_position renumbering ---

/**
 * Three independent scopes (see issue #197):
 *   1. The 21 new top-level category index.mdx files -> globally unique positions, in
 *      header-nav order (manifest.newCategoryOrder). Reported for the record: this manifest
 *      does not move any of those 21 files (see file header SCOPE NOTE), so 0 files get this
 *      value written in this wave — the mapping is here for whichever wave creates them.
 *   2. Direct articles + deep-article "index" units within one top-level category -> 1..n,
 *      ordered by first appearance in manifest.moves (already curated in reading order).
 *   3. Pages inside one deep article (its non-index siblings) -> 1..n, same ordering rule.
 */
function computeSidebarPositions(manifest) {
  const scope1 = new Map(); // newCategory -> position
  manifest.raw.newCategoryOrder.forEach((cat, i) => scope1.set(cat, i + 1));

  // Group moves by top-level category, tracking each "item": a direct article, or a deep-article
  // unit (first occurrence of a multi-segment newCategory represents the whole deep article).
  const scope2Items = new Map(); // topCategory -> [{ key, isDeep, firstOld }]
  const seenDeepUnit = new Set();
  for (const { old, newCategory } of manifest.raw.moves) {
    const isDeep = newCategory.includes("/");
    const topCategory = newCategory.split("/")[0];
    const itemKey = isDeep ? newCategory : old;
    if (isDeep && seenDeepUnit.has(newCategory)) continue;
    if (isDeep) seenDeepUnit.add(newCategory);
    if (!scope2Items.has(topCategory)) scope2Items.set(topCategory, []);
    scope2Items.get(topCategory).push({ key: itemKey, isDeep, deepCategory: newCategory, old });
  }
  const scope2 = new Map(); // itemKey -> position (itemKey = old path for direct articles, newCategory for deep units)
  for (const [, items] of scope2Items) {
    items.forEach((item, i) => scope2.set(item.key, i + 1));
  }

  // Scope 3: within each deep-article newCategory, non-index siblings get 1..n in manifest order.
  const scope3Groups = new Map(); // deepCategory -> [old...]
  for (const { old, newCategory } of manifest.raw.moves) {
    if (!newCategory.includes("/")) continue;
    if (posix.basename(old) === "index.mdx") continue;
    if (!scope3Groups.has(newCategory)) scope3Groups.set(newCategory, []);
    scope3Groups.get(newCategory).push(old);
  }
  const scope3 = new Map(); // old -> position
  for (const [, olds] of scope3Groups) {
    olds.forEach((old, i) => scope3.set(old, i + 1));
  }

  return { scope1, scope2, scope2Items, scope3 };
}

/**
 * For a single moved file (old path), determine its new sidebar_position per the scopes above.
 * Deep-article index.mdx files get their scope-2 position (their slot among the parent
 * category's direct items); every other moved file gets its scope-3 (if inside a deep article)
 * or scope-2 (if a direct top-level article) position.
 */
function positionFor(old, newCategory, positions) {
  const isDeep = newCategory.includes("/");
  const isIndex = posix.basename(old) === "index.mdx";
  if (isDeep && isIndex) {
    return positions.scope2.get(newCategory); // deep-article unit's slot in its parent category
  }
  if (isDeep) {
    return positions.scope3.get(old);
  }
  return positions.scope2.get(old);
}

function rewriteSidebarPosition(content, newPosition) {
  if (newPosition == null) return { content, changed: false };
  const re = /^sidebar_position:\s*\d+\s*$/m;
  if (!re.test(content)) return { content, changed: false };
  const newContent = content.replace(re, `sidebar_position: ${newPosition}`);
  return { content: newContent, changed: newContent !== content };
}

// --- main ---

async function main() {
  const manifest = await loadManifest();
  const { inventory, onlyEn, onlyJa, perLocaleRel } = await buildInventory(manifest.movesMap);
  const collisions = findCollisions(inventory);
  const categoryDirMap = deriveCategoryDirMap(manifest);
  const positions = computeSidebarPositions(manifest);

  if (onlyEn.length || onlyJa.length) {
    console.warn("WARNING: EN/JA docs trees are not perfect mirrors:");
    if (onlyEn.length) console.warn("  EN only:", onlyEn);
    if (onlyJa.length) console.warn("  JA only:", onlyJa);
  }
  if (collisions.length) {
    console.error("ERROR: move collisions detected (multiple old files -> same new path):");
    for (const c of collisions) console.error(`  ${c.newRel} <- ${c.olds.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const movedOldRels = [...manifest.movesMap.keys()];

  // Verify every manifest entry actually exists on disk, IN EACH LOCALE INDEPENDENTLY. Checking
  // against the shared `inventory` (built from the EN∪JA union) would pass even when a manifest
  // path exists in only one locale's tree — codex-review finding P2 on this file: that gap would
  // let --apply silently migrate only the existing copy and leave the trees non-mirrored.
  const missingPerLocale = [];
  for (const locale of LOCALES) {
    const localeSet = perLocaleRel.get(locale.code);
    for (const rel of movedOldRels) {
      if (!localeSet.has(rel)) missingPerLocale.push({ locale: locale.code, rel });
    }
  }
  if (missingPerLocale.length) {
    console.error("ERROR: manifest references files missing from one locale's tree:");
    for (const m of missingPerLocale) console.error(`  [${m.locale}] ${m.rel}`);
    process.exitCode = 1;
    return;
  }

  const report = {
    filesInScope: [], // { locale, oldRel, newRel, physicalMove } — every manifest entry, incl. path-unchanged ones
    filesMoved: [], // { locale, oldRel, newRel } — subset of filesInScope where the path text actually changes (git mv)
    filesDeleted: [], // none in this wave — reserved for a future wave that removes deletedRoutes dirs
    linksRewritten: [], // { locale, sourceRel, from, to }
    categoryNavRewritten: [],
    positionsRenumbered: [], // { locale, rel, from, to }
    unresolvedLinks: [],
    extensionlessLinksNeedingManualReview: [], // { locale, sourceRel, rawTarget } — see EXTENSIONLESS_RELATIVE_LINK_RE comment
  };

  // Pre-read every file's current content once (shared across both link-rewrite passes).
  const fileContents = new Map(); // `${locale}:${rel}` -> content

  for (const locale of LOCALES) {
    for (const rel of inventory.keys()) {
      const absPath = path.join(ROOT, locale.relRoot, rel);
      let content;
      try {
        content = await readFile(absPath, "utf-8");
      } catch {
        continue; // shouldn't happen post-mirror-check, but don't crash the report over it
      }
      fileContents.set(`${locale.code}:${rel}`, content);
    }
  }

  const writeQueue = []; // { locale, rel (new), content } — used only when APPLY

  for (const locale of LOCALES) {
    for (const rel of inventory.keys()) {
      const key = `${locale.code}:${rel}`;
      let content = fileContents.get(key);
      if (content == null) continue;
      const info = inventory.get(rel);

      for (const found of findExtensionlessRelativeLinks(content, rel)) {
        report.extensionlessLinksNeedingManualReview.push({ locale: locale.code, ...found });
      }

      const relResult = rewriteRelativeLinks(content, rel, inventory);
      content = relResult.content;
      const absResult = rewriteAbsoluteLinks(content, rel, inventory);
      content = absResult.content;
      const navResult = rewriteCategoryNav(content, rel, categoryDirMap);
      content = navResult.content;

      for (const c of [...relResult.changes, ...absResult.changes]) {
        report.linksRewritten.push({ locale: locale.code, ...c });
      }
      for (const c of navResult.changes) {
        report.categoryNavRewritten.push({ locale: locale.code, ...c });
      }
      for (const u of [...relResult.unresolved, ...absResult.unresolved]) {
        report.unresolvedLinks.push({ locale: locale.code, ...u });
      }

      if (info.inScope) {
        const newCategory = manifest.movesMap.get(rel);
        const newPosition = positionFor(rel, newCategory, positions);
        const posResult = rewriteSidebarPosition(content, newPosition);
        content = posResult.content;
        if (posResult.changed) {
          report.positionsRenumbered.push({ locale: locale.code, rel: info.newRel, position: newPosition });
        }
        report.filesInScope.push({ locale: locale.code, oldRel: rel, newRel: info.newRel, physicalMove: info.moved });
        if (info.moved) {
          report.filesMoved.push({ locale: locale.code, oldRel: rel, newRel: info.newRel });
        }
      }

      writeQueue.push({ locale, rel, info, content });
    }
  }

  // --- report ---

  console.log(`\n=== restructure-docs.mjs ${DRY_RUN ? "(DRY RUN)" : "(APPLY)"} ===\n`);
  console.log(`Manifest: ${manifest.raw.moves.length} moves, ${manifest.raw.deletedRoutes.length} deleted routes, ${manifest.raw.newCategoryOrder.length} categories in newCategoryOrder.`);
  console.log(`Files tracked in inventory: ${[...inventory.keys()].length} distinct docs-relative paths (mirrored across EN/JA).`);
  console.log(`Files physically moved (git mv): ${report.filesMoved.length} (${report.filesMoved.length / 2} per locale).`);
  console.log(`Files in scope but path-unchanged (already at their new top-level dir, e.g. responsive/, overview/): ${report.filesInScope.length - report.filesMoved.length} (${(report.filesInScope.length - report.filesMoved.length) / 2} per locale).`);
  console.log(`Links rewritten: ${report.linksRewritten.length}.`);
  console.log(`CategoryNav tags rewritten: ${report.categoryNavRewritten.length}.`);
  console.log(`sidebar_position values renumbered: ${report.positionsRenumbered.length}.`);
  console.log(`Unresolved links: ${report.unresolvedLinks.length}.`);
  console.log(`Extensionless relative links needing MANUAL review (not rewritten by this script — see EXTENSIONLESS_RELATIVE_LINK_RE comment): ${report.extensionlessLinksNeedingManualReview.length}.`);

  if (report.unresolvedLinks.length) {
    console.log("\n--- UNRESOLVED LINKS ---");
    for (const u of report.unresolvedLinks) {
      console.log(`  [${u.locale}] ${u.sourceRel} -> ${u.rawTarget} (resolved: ${u.resolvedTarget}) — ${u.reason}`);
    }
  }

  if (report.extensionlessLinksNeedingManualReview.length) {
    console.log("\n--- EXTENSIONLESS RELATIVE LINKS (not rewritten — verify manually after --apply) ---");
    for (const u of report.extensionlessLinksNeedingManualReview) {
      console.log(`  [${u.locale}] ${u.sourceRel} -> ${u.rawTarget}`);
    }
  }

  console.log(`\nScope-1 (category index.mdx global positions) computed for ${positions.scope1.size} categories — 0 files written this wave (none of the 21 index.mdx files are in the move manifest; see file header).`);

  const enInScope = report.filesInScope.filter((m) => m.locale === "en");
  const jaInScope = report.filesInScope.filter((m) => m.locale === "ja");
  const enArticleCount = manifest.raw.moves.length;
  console.log(`\nAccounting: ${enInScope.length}/${enArticleCount} EN manifest files accounted for on disk. ${jaInScope.length}/${enArticleCount} JA manifest files accounted for on disk.`);

  if (JSON_OUT) {
    await writeFile(path.resolve(ROOT, JSON_OUT), JSON.stringify(report, null, 2) + "\n", "utf-8");
    console.log(`\nFull report written to ${JSON_OUT}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. No files were written. Pass --apply to perform the move for real.");
    if (report.unresolvedLinks.length > 0) process.exitCode = 1;
    return;
  }

  // --- APPLY: perform real git mv + content writes ---

  console.log("\nApplying changes...");

  for (const locale of LOCALES) {
    for (const { oldRel, newRel } of report.filesMoved.filter((m) => m.locale === locale.code)) {
      const oldAbs = path.join(ROOT, locale.relRoot, oldRel);
      const newAbs = path.join(ROOT, locale.relRoot, newRel);
      await mkdir(path.dirname(newAbs), { recursive: true });
      execFileSync("git", ["mv", oldAbs, newAbs], { cwd: ROOT, stdio: "inherit" });
    }
  }

  for (const { locale, rel, info, content } of writeQueue) {
    const finalRel = info.newRel;
    const absPath = path.join(ROOT, locale.relRoot, finalRel);
    await writeFile(absPath, content, "utf-8");
  }

  console.log("Apply complete.");
  if (report.unresolvedLinks.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
