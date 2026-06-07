#!/usr/bin/env node

/**
 * check-links.js — Post-build broken link checker
 *
 * Mode 1: Scan built HTML in dist/ for broken internal links
 * Mode 2: Scan MDX source for absolute links bypassing base path
 */

import { readFile, readdir, access } from "node:fs/promises";
import { join, extname, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// --- Utilities ---

export async function parseBasePath(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");
  const match = content.match(/base:\s*["']([^"']*)["']/);
  return match ? match[1] : "/";
}

export async function parseTrailingSlash(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");
  const match = content.match(/trailingSlash:\s*(true|false)/);
  return match ? match[1] === "true" : false;
}

export async function parseContentDirs(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");

  // Extract docsDir
  const docsDirMatch = content.match(/docsDir:\s*["']([^"']*)["']/);
  const docsDir = docsDirMatch ? docsDirMatch[1] : "src/content/docs";

  // Extract locale content dirs. Supports both the legacy `docsJaDir: "..."`
  // form and the current settings shape `locales: { ja: { dir: "..." } }`.
  const localeDirs = [];

  const legacyRegex = /docs[A-Z][a-z]+Dir:\s*["']([^"']*)["']/g;
  let legacyMatch;
  while ((legacyMatch = legacyRegex.exec(content)) !== null) {
    localeDirs.push(legacyMatch[1]);
  }

  // Current shape: pull each `dir: "..."` out of the `locales` object.
  // Scoped to the first `locales: {...}` block so unrelated `dir:` props
  // elsewhere in settings.ts (e.g. nav locale overrides) aren't picked up.
  const localesBlockMatch = content.match(/locales:\s*\{([\s\S]*?)\n\s*\},?/);
  if (localesBlockMatch) {
    const dirRegex = /\bdir:\s*["']([^"']*)["']/g;
    let dirMatch;
    while ((dirMatch = dirRegex.exec(localesBlockMatch[1])) !== null) {
      localeDirs.push(dirMatch[1]);
    }
  }

  return { docsDir, localeDirs: [...new Set(localeDirs)] };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function collectFiles(dir, extensions) {
  const results = [];

  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// --- HTML Link Extraction ---

export function extractHtmlLinks(html) {
  const links = [];
  const regex = /<a\s[^>]*?href=(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
  let match;
  let lastIndex = 0;
  let currentLine = 1;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1] || match[2];
    if (/^https?:\/\//i.test(href)) continue;
    if (/^#/.test(href)) continue;
    if (/^mailto:/i.test(href)) continue;
    if (/^javascript:/i.test(href)) continue;
    if (/^data:/i.test(href)) continue;
    if (/^tel:/i.test(href)) continue;

    for (let i = lastIndex; i < match.index; i++) {
      if (html[i] === '\n') currentLine++;
    }
    lastIndex = match.index;
    links.push({ href, line: currentLine });
  }
  return links;
}

// --- Link Resolution ---

/**
 * Resolve a link and return its resolution type:
 *   'root'           — empty path or resolves to the site root (always valid)
 *   'file'           — resolved to a file with an extension or a .html file
 *   'directoryIndex' — resolved via dir/index.html (page link without trailing slash)
 *   'missing'        — target does not exist
 */
export async function resolveLinkDetail(href, distDir, basePath = "/", fileDir = "") {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return "root";

  let absolute = clean;

  // Resolve relative links against the file's directory within dist
  if (!clean.startsWith("/")) {
    // Relative link — resolve against the file's containing directory
    const dirInDist = fileDir ? relative(distDir, fileDir) : "";
    absolute = "/" + join(dirInDist, clean);
  }

  // Strip base path prefix from the href to get the path relative to dist/
  let stripped = absolute;
  if (basePath !== "/" && stripped.startsWith(basePath)) {
    stripped = "/" + stripped.slice(basePath.length);
  }

  const relPath = stripped.startsWith("/") ? stripped.slice(1) : stripped;
  if (!relPath) return "root";

  // Has file extension → check exact path
  if (extname(relPath)) {
    const exists = await fileExists(join(distDir, relPath));
    return exists ? "file" : "missing";
  }

  // Ends with / → check index.html inside
  if (relPath.endsWith("/")) {
    const exists = await fileExists(join(distDir, relPath, "index.html"));
    return exists ? "directoryIndex" : "missing";
  }

  // No extension, no trailing slash → try dir/index.html then .html
  if (await fileExists(join(distDir, relPath, "index.html"))) return "directoryIndex";
  if (await fileExists(join(distDir, relPath + ".html"))) return "file";
  return "missing";
}

export async function resolveLink(href, distDir, basePath = "/", fileDir = "") {
  const type = await resolveLinkDetail(href, distDir, basePath, fileDir);
  return type !== "missing";
}

// --- MDX Source Scan ---

/**
 * Strip inline-code spans from a line before running link regexes.
 * Handles double-backtick spans (``...``) and single-backtick spans (`...`).
 * Escaped backticks (\`) are ignored.
 */
export function stripInlineCode(line) {
  // Replace double-backtick spans first to avoid partial single-backtick matches
  let result = line.replace(/(?<!\\)``[^`]*(?:``|$)/g, (m) => " ".repeat(m.length));
  // Replace single-backtick spans
  result = result.replace(/(?<!\\)`[^`]*(?:`|$)/g, (m) => " ".repeat(m.length));
  return result;
}

export function extractMdxAbsoluteLinks(content) {
  const issues = [];
  const lines = content.split("\n");
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const searchLine = stripInlineCode(line);

    // Markdown link syntax: [text](/docs/...) or [text](/ja/docs/...)
    const mdRegex = /\]\((\/(?:ja\/)?docs\/[^)]*)\)/g;
    let match;
    while ((match = mdRegex.exec(searchLine)) !== null) {
      issues.push({ href: match[1], line: i + 1 });
    }

    // JSX href attributes: href="/docs/..." or href="/ja/docs/..."
    const jsxRegex = /href="(\/(?:ja\/)?docs\/[^"]*)"/g;
    while ((match = jsxRegex.exec(searchLine)) !== null) {
      issues.push({ href: match[1], line: i + 1 });
    }
  }

  return issues;
}

// --- Main Check Functions ---

export async function checkHtmlLinks(distDir, rootDir, basePath = "/", excludePatterns = []) {
  const broken = [];
  const htmlFiles = await collectFiles(distDir, [".html"]);
  const cache = new Map();

  for (const file of htmlFiles) {
    const content = await readFile(file, "utf-8");
    const links = extractHtmlLinks(content);
    const fileDir = dirname(file);

    for (const { href, line } of links) {
      if (excludePatterns.some((p) => p.test(href))) continue;

      // Cache key: absolute links use href only; relative links include fileDir
      const cacheKey = href.startsWith("/") ? href : `${fileDir}:${href}`;
      let exists;
      if (cache.has(cacheKey)) {
        exists = cache.get(cacheKey);
      } else {
        exists = await resolveLink(href, distDir, basePath, fileDir);
        cache.set(cacheKey, exists);
      }

      if (!exists) {
        broken.push({ file: relative(rootDir, file), line, href });
      }
    }
  }

  return broken;
}

export async function checkTrailingSlashLinks(distDir, rootDir, basePath = "/", excludePatterns = []) {
  const warnings = [];
  const htmlFiles = await collectFiles(distDir, [".html"]);
  const cache = new Map();

  for (const file of htmlFiles) {
    const content = await readFile(file, "utf-8");
    const links = extractHtmlLinks(content);
    const fileDir = dirname(file);

    for (const { href, line } of links) {
      if (excludePatterns.some((p) => p.test(href))) continue;

      // Extract path portion (strip query string and fragment)
      const pathPart = href.split("#")[0].split("?")[0];

      // Skip root-like paths: empty, "/", ".", "./"
      if (!pathPart || pathPart === "/" || pathPart === "." || pathPart === "./") continue;

      // Skip links that already have a trailing slash
      if (pathPart.endsWith("/")) continue;

      // Skip links with file extensions (assets)
      if (extname(pathPart)) continue;

      // Cache key: absolute links use href only; relative links include fileDir
      const cacheKey = href.startsWith("/") ? href : `${fileDir}:${href}`;
      let type;
      if (cache.has(cacheKey)) {
        type = cache.get(cacheKey);
      } else {
        type = await resolveLinkDetail(href, distDir, basePath, fileDir);
        cache.set(cacheKey, type);
      }

      // Only warn for links that resolve to a directory index (page links missing trailing slash)
      if (type === "directoryIndex") {
        warnings.push({ file: relative(rootDir, file), line, href });
      }
    }
  }

  return warnings;
}

export async function checkMdxLinks(contentDirs, rootDir, distDir = null, basePath = "/") {
  const warnings = [];

  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    const files = await collectFiles(dir, [".mdx", ".md"]);

    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const issues = extractMdxAbsoluteLinks(content);

      for (const { href, line } of issues) {
        // If dist/ is available, drop warnings for hrefs that resolve to built routes
        if (distDir && (await resolveLink(href, distDir, basePath))) continue;
        warnings.push({ file: relative(rootDir, file), line, href });
      }
    }
  }

  return warnings;
}

// --- Report ---

export function formatReport(brokenLinks, mdxWarnings, trailingSlashWarnings = []) {
  const lines = [];

  if (brokenLinks.length > 0) {
    lines.push("=== Broken Links in Built HTML ===");
    for (const { file, line, href } of brokenLinks) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  if (mdxWarnings.length > 0) {
    lines.push("=== Absolute Links Bypassing Base Path (MDX Source) ===");
    for (const { file, line, href } of mdxWarnings) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  if (trailingSlashWarnings.length > 0) {
    lines.push("=== Links Missing Trailing Slash ===");
    for (const { file, line, href } of trailingSlashWarnings) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  const total = brokenLinks.length + mdxWarnings.length + trailingSlashWarnings.length;
  if (total > 0) {
    const parts = [];
    if (brokenLinks.length > 0) {
      parts.push(
        `${brokenLinks.length} broken link${brokenLinks.length === 1 ? "" : "s"}`,
      );
    }
    if (mdxWarnings.length > 0) {
      parts.push(
        `${mdxWarnings.length} absolute path warning${mdxWarnings.length === 1 ? "" : "s"}`,
      );
    }
    if (trailingSlashWarnings.length > 0) {
      parts.push(
        `${trailingSlashWarnings.length} trailing slash warning${trailingSlashWarnings.length === 1 ? "" : "s"}`,
      );
    }
    lines.push(`✗ Found ${parts.join(" and ")}`);
  } else {
    lines.push("✓ No broken links or absolute path issues found");
  }

  return lines.join("\n");
}

// --- Allowlist ---

/**
 * Read the allowlist file (one entry per line; `#` comments stripped).
 * Each non-blank line is a literal `<file>:<line>:<href>` exact match.
 * Returns a Set for O(1) lookup against `entryKey()` output below.
 */
export async function readAllowlist(allowlistPath) {
  if (!allowlistPath) return new Set();
  if (!(await fileExists(allowlistPath))) return new Set();
  const text = await readFile(allowlistPath, "utf-8");
  const lines = text
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l.length > 0);
  return new Set(lines);
}

function entryKey(e) {
  return `${e.file}:${e.line}:${e.href}`;
}

// --- Main ---

async function main() {
  const rootDir = resolve(__dirname, "..");
  const settingsPath = join(rootDir, "src", "config", "settings.ts");
  const basePath = await parseBasePath(settingsPath);
  const trailingSlash = await parseTrailingSlash(settingsPath);
  const distDir = join(rootDir, "dist");

  console.log(`Checking links (base: ${basePath}, trailingSlash: ${trailingSlash})...\n`);

  if (!(await fileExists(distDir))) {
    console.error("Error: dist/ directory not found. Run 'pnpm build' first.");
    process.exit(1);
  }

  // Exclude versioned docs links — version content may be incomplete
  const excludePatterns = [/\/v\/[^/]+\//];

  const { docsDir, localeDirs } = await parseContentDirs(settingsPath);
  const contentDirs = [join(rootDir, docsDir), ...localeDirs.map((d) => join(rootDir, d))];

  const checks = [
    checkHtmlLinks(distDir, rootDir, basePath, excludePatterns),
    checkMdxLinks(contentDirs, rootDir, distDir, basePath),
  ];

  if (trailingSlash) {
    checks.push(checkTrailingSlashLinks(distDir, rootDir, basePath, excludePatterns));
  }

  let [brokenLinks, mdxWarnings, trailingSlashWarnings = []] = await Promise.all(checks);

  // --- Flag parsing ---
  //
  // Three strict knobs (separable so a deploy can fail on real 404s
  // without blocking on warn-only categories) plus an allowlist:
  //
  //   --strict           legacy: fail when any category has entries
  //   --strict-broken    fail when broken links > 0 (after allowlist)
  //   --strict-absolute  fail when absolute warnings > 0 (after allowlist)
  //   --strict-trailing  fail when trailing-slash warnings > 0 (after allowlist)
  //   --allowlist=PATH   skip entries listed in PATH (one
  //                      `<file>:<line>:<href>` per line, `#` comments)
  const argv = process.argv.slice(2);
  const strict = argv.includes("--strict");
  const strictBroken = strict || argv.includes("--strict-broken");
  const strictAbsolute = strict || argv.includes("--strict-absolute");
  const strictTrailing = strict || argv.includes("--strict-trailing");
  const allowlistArg = argv.find((a) => a.startsWith("--allowlist="));
  const allowlistPath = allowlistArg ? allowlistArg.split("=").slice(1).join("=") : null;
  const resolvedAllowlist = allowlistPath
    ? (allowlistPath.startsWith("/") ? allowlistPath : join(rootDir, allowlistPath))
    : null;
  const allowlist = await readAllowlist(resolvedAllowlist);

  // Filter out allowlisted entries before strict-mode decisions but
  // AFTER the printed report — so the report shows the full picture
  // and the strict gate counts only "real" entries.
  const filterOut = (entries) => entries.filter((e) => !allowlist.has(entryKey(e)));
  const realBroken = filterOut(brokenLinks);
  const realAbsolute = filterOut(mdxWarnings);
  const realTrailing = filterOut(trailingSlashWarnings);

  console.log(formatReport(brokenLinks, mdxWarnings, trailingSlashWarnings));

  if (allowlist.size > 0) {
    const skipped =
      (brokenLinks.length - realBroken.length) +
      (mdxWarnings.length - realAbsolute.length) +
      (trailingSlashWarnings.length - realTrailing.length);
    if (skipped > 0) {
      console.log(
        `\nAllowlist: ${skipped} known exception${skipped === 1 ? "" : "s"} excluded from strict-mode counts (${resolvedAllowlist}).`,
      );
    }
  }

  const hasIssues =
    brokenLinks.length > 0 || mdxWarnings.length > 0 || trailingSlashWarnings.length > 0;

  // Per-category strict failure (real counts). Combined into one exit
  // code so b4push only needs one invocation. Print which category
  // tripped before exiting so the diagnosis is obvious from the log.
  let failed = false;
  if (strictBroken && realBroken.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realBroken.length} broken link${realBroken.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (strictAbsolute && realAbsolute.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realAbsolute.length} absolute MDX-source link${realAbsolute.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (strictTrailing && realTrailing.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realTrailing.length} trailing-slash warning${realTrailing.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (failed) {
    process.exit(1);
  }

  if (hasIssues && !strictBroken && !strictAbsolute && !strictTrailing) {
    console.log("\nNote: Issues found but running in non-strict mode (exit 0).");
    console.log(
      "Use --strict-broken / --strict-absolute / --strict-trailing (or --strict for all) to fail on issues.",
    );
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
