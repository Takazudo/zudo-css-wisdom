#!/usr/bin/env node

/**
 * check-category-meta.mjs — guard against silently-dropped category metadata.
 *
 * CANONICAL COPY: wisdom-tweaker/shared/scripts/. Distributed verbatim to every
 * *-wisdom repo as scripts/check-category-meta.mjs. Edit it here, then re-sync.
 *
 * Why this exists (Takazudo/zudo-css-wisdom#183):
 *
 *   zudo-doc's `loadCategoryMeta` reads `_category_.json` with `node:fs`. Under
 *   zfb — zudo-doc's own host — the SSG bundle is built `--platform=neutral
 *   --external:node:*`, and zfb's embedded-V8 host resolves `node:fs` to a
 *   throwing proxy. `scanDir` swallows the throw in a bare `catch { return; }`
 *   and caches the resulting EMPTY map for the process lifetime.
 *
 *   Every `label`, `position`, `description` and `noPage` in every sidecar is
 *   therefore discarded — with no error, no warning, and a green build. In
 *   css-wisdom that silently published 36 category pages marked `noPage: true`,
 *   ~14% of the sitemap, and nobody noticed for months.
 *
 * Neither `zfb check`, `html-validate`, nor `check-links --strict-broken` can
 * see this: nothing is a broken link, the pages render fine — they simply
 * should not exist. Hence a dedicated source-level check.
 *
 * Checks:
 *   1. FAIL on any `_category_.json` under src/. Upstream retired the sidecar in
 *      favour of index.mdx frontmatter; any remaining file is dead weight that
 *      reads as configuration but is silently ignored.
 *   2. FAIL when a `headerNav` entry targets a page with `category_no_page:
 *      true`, in the default locale OR in any configured locale. Suppressing a
 *      category the header links to turns that link into a site-wide 404, and
 *      zfb's `--strict-broken` does NOT catch it.
 *
 * ── A NOTE ON SELF-DEFEAT ─────────────────────────────────────────────────
 * The first version of this script printed a green OK on a repo where it had
 * parsed ZERO nav entries, because that repo declares `headerNav` in
 * src/config/settings.ts and spreads it into zfb.config.ts — so the regex found
 * nothing and "checked everything successfully" was indistinguishable from
 * "checked nothing". A guard against silent false-greens that itself
 * false-greens is worse than no guard, because it manufactures confidence.
 *
 * Two rules follow, and both must be preserved by anyone editing this file:
 *   - ALWAYS report the counts actually inspected (sidecars scanned, nav entries
 *     parsed, locales considered). A reader must be able to see "0 checked".
 *   - Treat "found no headerNav at all" as a WARNING worth printing loudly, not
 *     as success. Absence of findings is not evidence of correctness.
 *
 * Unresolvable nav paths are warnings, not failures — the path→file resolution
 * is a heuristic and must not fail a build on its own uncertainty.
 *
 * Usage: node scripts/check-category-meta.mjs
 * Exit:  0 = OK (warnings allowed), 1 = violations found
 */

import { readFile, readdir, access } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the latter keeps percent-escapes, so a checkout
// under a path with spaces or non-ASCII silently resolves to a directory that
// does not exist, walk() swallows the ENOENT, and the script exits 0 having
// scanned nothing.
const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/[/\\]$/, "");
const SRC = join(ROOT, "src");
const CONFIG = join(ROOT, "zfb.config.ts");
// headerNav may live directly in zfb.config.ts or in a settings module that the
// config spreads. Both shapes exist across the wisdom repos.
const CONFIG_SOURCES = [CONFIG, join(ROOT, "src", "config", "settings.ts")];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".astro", ".zfb", ".zfb-build"]);
const PAGE_EXTS = [".mdx", ".md"];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(join(dir, e.name), out);
    } else {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/** Extract the leading `---` frontmatter block, or "" when absent. */
function frontmatter(source) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : "";
}

/**
 * YAML truthiness for `category_no_page`. Accepts the spellings a YAML parser
 * treats as true — `true`, `True`, `TRUE`, `yes`, `on` — and tolerates a
 * trailing `# comment`. The original `:\s*true\s*$` form missed all of these
 * and false-greened on exactly the dead nav link this check exists to catch.
 */
function hasNoPage(fm) {
  const m = fm.match(/^\s*category_no_page\s*:\s*([^#\r\n]*)/m);
  if (!m) return false;
  return /^(true|yes|on)$/i.test(m[1].trim());
}

/**
 * Pull `path:` values out of a `headerNav: [ ... ]` array. Regex rather than a
 * TS parse: the configs are plain literals and this script stays dependency-free.
 * Returns [] when the file declares no headerNav.
 */
function parseHeaderNav(source) {
  const start = source.indexOf("headerNav:");
  if (start === -1) return [];
  const open = source.indexOf("[", start);
  if (open === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  return [...source.slice(open, end).matchAll(/path\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

function parseDocsDir(source) {
  const m = source.match(/docsDir\s*:\s*["']([^"']+)["']/);
  return m ? m[1] : "src/content/docs";
}

function parseBase(source) {
  const m = source.match(/\bbase\s*:\s*["']([^"']*)["']/);
  return m ? m[1] : "/";
}

/**
 * Parse `locales: { ja: { label: "JA", dir: "src/content/docs-ja" }, ... }`.
 * A locale-only `category_no_page` suppresses that locale's route while the
 * localized header link survives — the headline failure mode, and one the
 * default-docsDir-only resolution was completely blind to.
 */
function parseLocales(source) {
  const start = source.indexOf("locales:");
  if (start === -1) return [];
  const open = source.indexOf("{", start);
  if (open === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const block = source.slice(open, end);
  return [...block.matchAll(/(\w+)\s*:\s*\{[^}]*?\bdir\s*:\s*["']([^"']+)["']/g)].map((m) => ({
    locale: m[1],
    dir: m[2],
  }));
}

const failures = [];
const warnings = [];
const notes = [];

// ── Check 1: no _category_.json sidecars ──────────────────────────────────
const srcFiles = await walk(SRC);
// sep-aware so this also matches on Windows backslash paths.
const sidecars = srcFiles.filter(
  (f) => f.endsWith(`${sep}_category_.json`) || f.endsWith("/_category_.json"),
);

if (srcFiles.length === 0) {
  warnings.push(
    `[EMPTY-SCAN] no files found under ${relative(ROOT, SRC)}/ — the sidecar ` +
      `check inspected nothing. Verify the repo layout; this is not a pass.`,
  );
}
notes.push(`scanned ${srcFiles.length} source file(s) under ${relative(ROOT, SRC)}/`);

for (const f of sidecars) {
  failures.push(
    `[SIDECAR] ${relative(ROOT, f)} — _category_.json is silently ignored by ` +
      `zudo-doc under zfb. Move label/position/description/noPage into the ` +
      `directory's index.mdx frontmatter (sidebar_label / sidebar_position / ` +
      `description / category_no_page) and delete this file.`,
  );
}

// ── Check 2: headerNav must not target a suppressed category ──────────────
let navPaths = [];
let navSource = null;
let docsDir = "src/content/docs";
let base = "/";
let locales = [];

for (const candidate of CONFIG_SOURCES) {
  if (!(await exists(candidate))) continue;
  const source = await readFile(candidate, "utf-8");
  if (docsDir === "src/content/docs") docsDir = parseDocsDir(source);
  if (base === "/") base = parseBase(source);
  if (locales.length === 0) locales = parseLocales(source);
  const found = parseHeaderNav(source);
  if (found.length > 0 && navPaths.length === 0) {
    navPaths = found;
    navSource = candidate;
  }
}

if (navPaths.length === 0) {
  warnings.push(
    `[NO-NAV] no headerNav entries found in ${CONFIG_SOURCES.map((c) => relative(ROOT, c)).join(" or ")}. ` +
      `The headerNav→suppressed-category check inspected ZERO links. If this ` +
      `site does define a header nav, it is declared somewhere this script does ` +
      `not look and the check is a no-op — fix the canonical script in ` +
      `wisdom-tweaker/shared/scripts/ rather than ignoring this warning.`,
  );
} else {
  notes.push(
    `parsed ${navPaths.length} headerNav entr(ies) from ${relative(ROOT, navSource)}`,
  );
}
notes.push(
  locales.length > 0
    ? `checking ${locales.length + 1} locale dir(s): ${docsDir}, ${locales.map((l) => l.dir).join(", ")}`
    : `checking 1 locale dir: ${docsDir}`,
);

/** Candidate source files for a nav slug within one content dir. */
function candidatesFor(dir, slug) {
  const out = [];
  for (const ext of PAGE_EXTS) {
    if (slug) {
      out.push(join(ROOT, dir, slug, `index${ext}`));
      out.push(join(ROOT, dir, `${slug}${ext}`));
    } else {
      out.push(join(ROOT, dir, `index${ext}`));
    }
  }
  return out;
}

for (const navPath of navPaths) {
  let slug = navPath;
  if (base && base !== "/" && slug.startsWith(base)) slug = slug.slice(base.length);
  slug = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  if (slug === "docs") slug = "";
  else if (slug.startsWith("docs/")) slug = slug.slice("docs/".length);

  // Check the default locale and every configured locale — a suppressed JA
  // page behind a surviving JA header link is just as much a 404.
  const targets = [{ locale: "(default)", dir: docsDir }, ...locales];
  let resolvedAnywhere = false;

  for (const t of targets) {
    let resolved = null;
    for (const c of candidatesFor(t.dir, slug)) {
      if (await exists(c)) {
        resolved = c;
        break;
      }
    }
    if (!resolved) continue;
    resolvedAnywhere = true;

    if (hasNoPage(frontmatter(await readFile(resolved, "utf-8")))) {
      failures.push(
        `[NAV-404] headerNav "${navPath}" targets ${relative(ROOT, resolved)} ` +
          `(locale ${t.locale}), which sets category_no_page. That page is ` +
          `never emitted, so the header link 404s. Remove the nav entry or ` +
          `drop category_no_page.`,
      );
    }
  }

  if (!resolvedAnywhere) {
    warnings.push(
      `[UNRESOLVED] headerNav "${navPath}" — no source file found in any ` +
        `content dir. Verify this link manually; the check could not.`,
    );
  }
}

// ── Report ────────────────────────────────────────────────────────────────
// Counts always print, so "checked nothing" can never masquerade as "all good".
for (const n of notes) console.log(`  · ${n}`);
for (const w of warnings) console.warn(`  ⚠️  ${w}`);

if (failures.length === 0) {
  console.log(`OK — category metadata check passed (${sidecars.length} sidecar(s) found).`);
  process.exit(0);
}

console.error("");
console.error(`FAILED — ${failures.length} category metadata problem(s):`);
for (const f of failures) console.error(`   - ${f}`);
process.exit(1);
