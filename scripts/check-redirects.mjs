#!/usr/bin/env node

/**
 * check-redirects.mjs — guard against a broken old-URL redirect after the
 * Flat Category Restructure (epic #196, sub-issue #200).
 *
 * The site is public and its URLs are referenced from the generated
 * css-wisdom skill and from notes in other repos. Every pre-migration URL
 * must keep resolving to a live page via public/_redirects.
 *
 * Checks:
 *   1. Reads scripts/path-migrations.json (the PERMANENT old-route inventory
 *      -- `moves`, `categoryIndexMoves`, `deletedRoutes`) and derives every
 *      pre-migration URL, EN and JA, both the bare and trailing-slash form.
 *   2. Resolves each one through public/_redirects, replaying Cloudflare's
 *      actual matching semantics: rules apply in FILE ORDER, first match
 *      wins (exact string match for a static rule, prefix match for a `*`
 *      splat rule) -- not "try every static rule, then every dynamic rule".
 *      Static rules merely happen to be listed first in this file, which is
 *      how they win; the resolver does not special-case rule type.
 *   3. Asserts the fully-resolved URL is a real page in dist/. A URL with no
 *      matching rule is checked directly (covers old routes that did not
 *      move, e.g. `/docs/responsive/*`, `/docs/overview/*`).
 *   4. FAILS on a redirect chain longer than 1 hop -- the epic's own rule is
 *      "point rules straight at the canonical destination; avoid old → new →
 *      canonical-trailing-slash chains". A chain is a sign a rule regressed
 *      to pointing at another old route instead of the live one.
 *   5. Asserts dist/.assetsignore does not list `_redirects` (it must ship as
 *      a real static asset, not get excluded from the deploy).
 *   6. Asserts dist/_redirects exists and its content matches public/_redirects
 *      byte-for-byte (the passthrough zfb is expected to perform).
 *   7. Reports static/dynamic rule counts against the Cloudflare Workers
 *      static-assets budget (2,000 static + 100 dynamic, 1,000 chars/line)
 *      as a WARNING if breached -- not a hard failure here, since the real
 *      enforcement is Cloudflare's own deploy-time validation, but a repo
 *      this close to the limit should not go unnoticed.
 *
 * Usage:
 *   node scripts/check-redirects.mjs             # verify against dist/ (run `pnpm build` first)
 *   node scripts/check-redirects.mjs --self-test  # adversarial resolver unit tests, no dist/ needed
 *
 * Exit: 0 = every old URL resolves; 1 = violations found.
 */

import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MANIFEST_PATH = path.join(ROOT, "scripts", "path-migrations.json");
const REDIRECTS_PATH = path.join(ROOT, "public", "_redirects");
const DIST_DIR = path.join(ROOT, "dist");

const STATIC_BUDGET = 2000;
const DYNAMIC_BUDGET = 100;
const MAX_LINE_CHARS = 1000;
const MAX_HOPS = 1; // "avoid old -> new -> canonical chains" -- 1 redirect hop is the ceiling

// ── _redirects parsing ──────────────────────────────────────────────────

/**
 * Parses public/_redirects into an ordered rule list, preserving file order
 * (which is what determines first-match-wins on a real Cloudflare deploy).
 * Each rule: { kind: "static" | "dynamic", from, to, lineNo }.
 *   static:  `from` is the exact source path.
 *   dynamic: `from` is the splat prefix (pattern with the trailing `*` cut off).
 */
function parseRedirects(text) {
  const rules = [];
  const lines = text.split("\n");
  let staticCount = 0;
  let dynamicCount = 0;
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    if (line.length > MAX_LINE_CHARS) {
      throw new Error(`_redirects:${i + 1} exceeds ${MAX_LINE_CHARS} chars (${line.length})`);
    }
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      throw new Error(`_redirects:${i + 1} unparseable line: "${line}"`);
    }
    const [from, to] = parts; // ignore trailing status code (301) -- always 301 here
    if (from.includes("*")) {
      if (!from.endsWith("/*")) {
        throw new Error(`_redirects:${i + 1} splat rule must end in "/*": "${from}"`);
      }
      rules.push({ kind: "dynamic", from: from.slice(0, -1), to, lineNo: i + 1 });
      dynamicCount++;
    } else {
      rules.push({ kind: "static", from, to, lineNo: i + 1 });
      staticCount++;
    }
  });
  return { rules, staticCount, dynamicCount };
}

/**
 * Applies first-match-wins over `rules` IN ORDER. Returns the matched rule,
 * or null if nothing matches (caller then checks the URL exists as-is).
 */
function matchRule(url, rules) {
  for (const rule of rules) {
    if (rule.kind === "static") {
      if (url === rule.from) return rule;
    } else {
      if (url.startsWith(rule.from)) return rule;
    }
  }
  return null;
}

/**
 * Follows redirects from `url` up to MAX_HOPS+1 resolution steps. Returns
 * { finalUrl, hops, error } where hops is the number of redirect rules
 * applied (0 means the URL itself was checked directly, no rule matched).
 */
function resolve(url, rules) {
  let current = url;
  const visited = new Set([current]);
  let hops = 0;
  for (;;) {
    const rule = matchRule(current, rules);
    if (!rule) return { finalUrl: current, hops, error: null };
    hops++;
    if (hops > MAX_HOPS) {
      return { finalUrl: current, hops, error: `redirect chain exceeds ${MAX_HOPS} hop(s) (rule at line ${rule.lineNo})` };
    }
    const next = rule.to;
    if (visited.has(next)) {
      return { finalUrl: current, hops, error: `redirect cycle detected at ${next} (rule at line ${rule.lineNo})` };
    }
    visited.add(next);
    current = next;
  }
}

// ── dist/ existence check ───────────────────────────────────────────────

async function pageExists(urlPath) {
  const clean = urlPath.replace(/\/+$/, ""); // trailing slash is irrelevant to file lookup
  const rel = clean === "" ? "/" : clean;
  const candidates = [
    path.join(DIST_DIR, rel, "index.html"),
    path.join(DIST_DIR, `${rel}.html`),
    path.join(DIST_DIR, rel), // non-HTML asset, exact file
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.F_OK);
      return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

// ── old-route inventory, derived from scripts/path-migrations.json ───────

function routeSuffixesFor(rel, category) {
  // rel: docs-relative path, with or without a trailing ".mdx" (moves have it,
  // categoryIndexMoves name a directory and don't).
  const withoutExt = rel.endsWith(".mdx") ? rel.slice(0, -4) : rel;
  const dir = path.dirname(withoutExt);
  const base = path.basename(withoutExt);
  if (base === "index") {
    // index.mdx (or a bare directory move) routes at the directory itself.
    const oldSuffix = dir === "." ? "" : dir;
    return { oldSuffix, newSuffix: category };
  }
  const oldSuffix = (dir === "." ? "" : `${dir}/`) + base;
  return { oldSuffix, newSuffix: `${category}/${base}` };
}

/**
 * Builds the full pre-migration URL inventory: every old EN + JA route, in
 * both bare and trailing-slash form. Returns [{ url, expectedNewUrl }], where
 * expectedNewUrl is null for an in-place route (old route === new route, no
 * redirect expected -- the page must simply already exist there).
 */
function buildInventory(manifest) {
  const pairs = []; // { oldRoute, newRoute } EN-form, e.g. "/docs/x" -> "/docs/y"

  for (const { old, newCategory } of manifest.moves) {
    const { oldSuffix, newSuffix } = routeSuffixesFor(old, newCategory);
    pairs.push({ oldRoute: `/docs/${oldSuffix}`, newRoute: `/docs/${newSuffix}` });
  }
  for (const { old, newCategory } of manifest.categoryIndexMoves) {
    pairs.push({ oldRoute: `/docs/${old}`, newRoute: `/docs/${newCategory}` });
  }
  for (const { oldCategory, redirectTarget } of manifest.deletedRoutes) {
    pairs.push({ oldRoute: `/docs/${oldCategory}`, newRoute: `/docs/${redirectTarget}` });
  }

  const inventory = [];
  for (const { oldRoute, newRoute } of pairs) {
    const inPlace = oldRoute === newRoute;
    for (const locale of ["", "/ja"]) {
      for (const suffix of ["", "/"]) {
        inventory.push({
          url: `${locale}${oldRoute}${suffix}`,
          expectedNewUrl: inPlace ? null : `${locale}${newRoute}`,
          sourceOldRoute: oldRoute,
        });
      }
    }
  }
  return inventory;
}

// ── self-test: adversarial resolver correctness, no dist/ needed ─────────

function runSelfTest() {
  const cases = [];
  let pass = 0;
  let fail = 0;

  function check(name, fn) {
    try {
      fn();
      pass++;
      cases.push({ name, ok: true });
    } catch (err) {
      fail++;
      cases.push({ name, ok: false, error: err.message });
    }
  }

  // Adversarial case 1: a specific static rule placed AFTER a dynamic splat
  // that would otherwise swallow it -- proves the resolver honours file
  // order (first-match-wins), not "prefer static over dynamic" as a type
  // rule. This mirrors the real #198 bug (an exception rule listed after a
  // broader splat became unreachable dead code).
  check("static rule shadowed when placed after its splat", () => {
    const { rules } = parseRedirects(
      [
        "/docs/layout/* /docs/flexbox-and-grid 301",
        "/docs/layout/specialized/foo /docs/sizing/foo 301",
      ].join("\n"),
    );
    const { finalUrl } = resolve("/docs/layout/specialized/foo", rules);
    if (finalUrl !== "/docs/flexbox-and-grid") {
      throw new Error(`expected the splat to win (file order), got ${finalUrl}`);
    }
  });

  // Adversarial case 2: the same rule set, but with the specific exception
  // correctly placed BEFORE the splat -- proves the resolver does apply
  // first-match-wins correctly once ordering is right, i.e. the previous
  // case is exercising real matching logic and not a stub.
  check("static rule wins when placed before its splat", () => {
    const { rules } = parseRedirects(
      [
        "/docs/layout/specialized/foo /docs/sizing/foo 301",
        "/docs/layout/* /docs/flexbox-and-grid 301",
      ].join("\n"),
    );
    const { finalUrl } = resolve("/docs/layout/specialized/foo", rules);
    if (finalUrl !== "/docs/sizing/foo") {
      throw new Error(`expected the specific static rule to win, got ${finalUrl}`);
    }
  });

  // Adversarial case 3: a more-specific splat prefix must precede its
  // broader umbrella splat, exactly as public/_redirects orders
  // /docs/layout/specialized/* before /docs/layout/*.
  check("more-specific splat wins over broader splat when ordered first", () => {
    const { rules } = parseRedirects(
      [
        "/docs/layout/specialized/* /docs/document-layout 301",
        "/docs/layout/* /docs/flexbox-and-grid 301",
      ].join("\n"),
    );
    const { finalUrl } = resolve("/docs/layout/specialized/anything", rules);
    if (finalUrl !== "/docs/document-layout") {
      throw new Error(`expected the specific splat to win, got ${finalUrl}`);
    }
  });

  // Adversarial case 4: broader splat ordered first incorrectly shadows the
  // specific one -- proves the resolver doesn't silently "fix" bad ordering.
  check("broader splat shadows more-specific splat when ordered first (regression trap)", () => {
    const { rules } = parseRedirects(
      [
        "/docs/layout/* /docs/flexbox-and-grid 301",
        "/docs/layout/specialized/* /docs/document-layout 301",
      ].join("\n"),
    );
    const { finalUrl } = resolve("/docs/layout/specialized/anything", rules);
    if (finalUrl !== "/docs/flexbox-and-grid") {
      throw new Error(`expected the broader (first) splat to win, got ${finalUrl}`);
    }
  });

  // Adversarial case 5: a bare umbrella root (no trailing content) must NOT
  // match a splat rule for that same prefix -- a splat's literal prefix
  // requires the "/" before the captured suffix.
  check("splat does not match its own bare root (no trailing slash, no suffix)", () => {
    const { rules } = parseRedirects(["/docs/layout/* /docs/flexbox-and-grid 301"].join("\n"));
    const { finalUrl, hops } = resolve("/docs/layout", rules);
    if (hops !== 0 || finalUrl !== "/docs/layout") {
      throw new Error(`expected no match (identity), got finalUrl=${finalUrl} hops=${hops}`);
    }
  });

  // Adversarial case 6: a chain of 2 redirects (old -> intermediate -> new)
  // must be reported as a chain-length violation, not silently followed.
  check("a 2-hop chain is flagged as exceeding MAX_HOPS", () => {
    const { rules } = parseRedirects(
      ["/docs/a /docs/b 301", "/docs/b /docs/c 301"].join("\n"),
    );
    const { error } = resolve("/docs/a", rules);
    if (!error || !error.includes("chain")) {
      throw new Error(`expected a chain-length error, got ${error}`);
    }
  });

  // Adversarial case 7: an identity URL with no matching rule resolves to
  // itself directly (0 hops) -- this is the in-place-route case (e.g.
  // /docs/responsive/* never moved and has no _redirects entry).
  check("unmatched URL resolves to itself with 0 hops", () => {
    const { rules } = parseRedirects(["/docs/a /docs/b 301"].join("\n"));
    const { finalUrl, hops } = resolve("/docs/never-moved", rules);
    if (hops !== 0 || finalUrl !== "/docs/never-moved") {
      throw new Error(`expected identity resolution, got finalUrl=${finalUrl} hops=${hops}`);
    }
  });

  console.log(`Self-test: ${pass} passed, ${fail} failed.`);
  for (const c of cases) {
    console.log(`  ${c.ok ? "✅" : "❌"} ${c.name}${c.ok ? "" : ` -- ${c.error}`}`);
  }
  return fail === 0;
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--self-test")) {
    const ok = runSelfTest();
    process.exit(ok ? 0 : 1);
  }

  const failures = [];
  const warnings = [];

  try {
    await access(DIST_DIR, fsConstants.F_OK);
  } catch {
    console.error(`❌ dist/ not found at ${DIST_DIR} -- run \`pnpm build\` first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
  const redirectsText = await readFile(REDIRECTS_PATH, "utf-8");
  const { rules, staticCount, dynamicCount } = parseRedirects(redirectsText);

  console.log(
    `Parsed public/_redirects: ${staticCount} static rule(s), ${dynamicCount} dynamic (splat) rule(s).`,
  );
  if (staticCount > STATIC_BUDGET) {
    failures.push(`static rule count ${staticCount} exceeds Cloudflare's ${STATIC_BUDGET} budget`);
  }
  if (dynamicCount > DYNAMIC_BUDGET) {
    failures.push(`dynamic rule count ${dynamicCount} exceeds Cloudflare's ${DYNAMIC_BUDGET} budget`);
  }
  if (staticCount === 0) {
    warnings.push("0 static rules parsed -- check-redirects.mjs may be mis-parsing public/_redirects");
  }

  const inventory = buildInventory(manifest);
  console.log(`Old-route inventory (EN+JA, both slash forms): ${inventory.length} URL(s) to verify.`);

  let checkedRedirected = 0;
  let checkedInPlace = 0;

  for (const { url, expectedNewUrl, sourceOldRoute } of inventory) {
    const { finalUrl, hops, error } = resolve(url, rules);
    if (error) {
      failures.push(`${url}: ${error}`);
      continue;
    }
    if (expectedNewUrl !== null && hops === 0) {
      failures.push(`${url}: expected a redirect to ${expectedNewUrl} but no rule matched (source: ${sourceOldRoute})`);
      continue;
    }
    if (expectedNewUrl !== null && finalUrl !== expectedNewUrl) {
      failures.push(`${url}: resolved to ${finalUrl}, expected ${expectedNewUrl}`);
      continue;
    }
    const exists = await pageExists(finalUrl);
    if (!exists) {
      failures.push(`${url}: resolves to ${finalUrl} (${hops} hop(s)) but no built page exists there`);
      continue;
    }
    if (hops > 0) checkedRedirected++;
    else checkedInPlace++;
  }

  console.log(`Resolved via redirect: ${checkedRedirected}. Resolved in-place (no redirect needed): ${checkedInPlace}.`);

  // dist/.assetsignore must not exclude _redirects from the deploy.
  const assetsIgnorePath = path.join(DIST_DIR, ".assetsignore");
  try {
    const assetsIgnore = await readFile(assetsIgnorePath, "utf-8");
    const listed = assetsIgnore
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (listed.includes("_redirects")) {
      failures.push("dist/.assetsignore lists `_redirects` -- it would be excluded from the deploy");
    }
  } catch {
    warnings.push(`could not read ${assetsIgnorePath} -- skipping .assetsignore check`);
  }

  // dist/_redirects must exist and match public/_redirects (the passthrough
  // zfb is expected to perform for everything under public/).
  const distRedirectsPath = path.join(DIST_DIR, "_redirects");
  try {
    const distRedirects = await readFile(distRedirectsPath, "utf-8");
    if (distRedirects !== redirectsText) {
      failures.push("dist/_redirects does not match public/_redirects -- passthrough may be broken");
    }
  } catch {
    failures.push(`dist/_redirects not found at ${distRedirectsPath}`);
  }

  console.log("");
  for (const w of warnings) console.log(`⚠️  ${w}`);

  if (failures.length > 0) {
    console.log(`❌ ${failures.length} violation(s):`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  }

  console.log(`✅ All ${inventory.length} old URLs resolve to an existing page. Redirect coverage OK.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ check-redirects.mjs crashed: ${err.stack || err.message}`);
  process.exit(1);
});
