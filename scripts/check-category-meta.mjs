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
 *   2. FAIL when a `headerNav` entry targets a page with
 *      `category_no_page: true`. Suppressing a category that the header links to
 *      turns that link into a site-wide 404, and zfb's `--strict-broken` does
 *      NOT catch it (measured on the zfb docs site).
 *
 * Unresolvable headerNav paths are reported as warnings, not failures — the
 * path→file resolution below is a heuristic and must never fail a build on its
 * own uncertainty.
 *
 * Usage: node scripts/check-category-meta.mjs
 * Exit:  0 = OK (warnings allowed), 1 = violations found
 */

import { readFile, readdir, access } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
const CONFIG = join(ROOT, "zfb.config.ts");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".astro", ".zfb", ".zfb-build"]);

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

function hasNoPage(fm) {
  return /^\s*category_no_page\s*:\s*true\s*$/m.test(fm);
}

/**
 * Pull `path:` values out of the `headerNav: [ ... ]` array in zfb.config.ts.
 * Regex rather than a TS parse: the config is a plain literal in every wisdom
 * repo, and this script must stay dependency-free.
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
  const block = source.slice(open, end);
  return [...block.matchAll(/path\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

function parseDocsDir(source) {
  const m = source.match(/docsDir\s*:\s*["']([^"']+)["']/);
  return m ? m[1] : "src/content/docs";
}

function parseBase(source) {
  const m = source.match(/\bbase\s*:\s*["']([^"']*)["']/);
  return m ? m[1] : "/";
}

const failures = [];
const warnings = [];

// ── Check 1: no _category_.json sidecars ──────────────────────────────────
const srcFiles = await walk(SRC);
const sidecars = srcFiles.filter((f) => f.endsWith("/_category_.json"));

for (const f of sidecars) {
  failures.push(
    `[SIDECAR] ${relative(ROOT, f)} — _category_.json is silently ignored by ` +
      `zudo-doc under zfb. Move label/position/description/noPage into the ` +
      `directory's index.mdx frontmatter (sidebar_label / sidebar_position / ` +
      `description / category_no_page) and delete this file.`,
  );
}

// ── Check 2: headerNav must not target a suppressed category ──────────────
if (await exists(CONFIG)) {
  const configSource = await readFile(CONFIG, "utf-8");
  const navPaths = parseHeaderNav(configSource);
  const docsDir = parseDocsDir(configSource);
  const base = parseBase(configSource);

  for (const navPath of navPaths) {
    // Strip the configured base prefix, then the leading route segment
    // (`/docs`), leaving the docsDir-relative slug.
    let slug = navPath;
    if (base && base !== "/" && slug.startsWith(base)) slug = slug.slice(base.length);
    slug = slug.replace(/^\/+/, "").replace(/\/+$/, "");
    if (slug === "docs") slug = "";
    else if (slug.startsWith("docs/")) slug = slug.slice("docs/".length);

    const candidates = slug
      ? [join(ROOT, docsDir, slug, "index.mdx"), join(ROOT, docsDir, `${slug}.mdx`)]
      : [join(ROOT, docsDir, "index.mdx")];

    let resolved = null;
    for (const c of candidates) {
      if (await exists(c)) {
        resolved = c;
        break;
      }
    }

    if (!resolved) {
      warnings.push(
        `[UNRESOLVED] headerNav "${navPath}" — could not resolve to a source ` +
          `file under ${docsDir}/. Verify the link manually; this check could ` +
          `not.`,
      );
      continue;
    }

    const fm = frontmatter(await readFile(resolved, "utf-8"));
    if (hasNoPage(fm)) {
      failures.push(
        `[NAV-404] headerNav "${navPath}" targets ${relative(ROOT, resolved)}, ` +
          `which sets category_no_page: true. That page is never emitted, so ` +
          `the header link 404s site-wide. Remove the nav entry or drop ` +
          `category_no_page.`,
      );
    }
  }
} else {
  warnings.push(`[NO-CONFIG] ${relative(ROOT, CONFIG)} not found — headerNav check skipped.`);
}

// ── Report ────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`  ⚠️  ${w}`);

if (failures.length === 0) {
  const scanned = sidecars.length === 0 ? "no sidecars" : `${sidecars.length} sidecars`;
  console.log(`OK — category metadata check passed (${scanned}).`);
  process.exit(0);
}

console.error("");
console.error(`FAILED — ${failures.length} category metadata problem(s):`);
for (const f of failures) console.error(`   - ${f}`);
process.exit(1);
