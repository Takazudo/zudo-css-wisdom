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

export async function parseContentDirs(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");

  // Extract docsDir
  const docsDirMatch = content.match(/docsDir:\s*["']([^"']*)["']/);
  const docsDir = docsDirMatch ? docsDirMatch[1] : "src/content/docs";

  // Extract locale content dirs (e.g. docsJaDir)
  const localeDirs = [];
  const localeRegex = /docs[A-Z][a-z]+Dir:\s*["']([^"']*)["']/g;
  let localeMatch;
  while ((localeMatch = localeRegex.exec(content)) !== null) {
    localeDirs.push(localeMatch[1]);
  }

  return { docsDir, localeDirs };
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

export async function resolveLink(href, distDir, basePath = "/", fileDir = "") {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;

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
  if (!relPath) return true;

  // Has file extension → check exact path
  if (extname(relPath)) {
    return fileExists(join(distDir, relPath));
  }

  // Ends with / → check index.html inside
  if (relPath.endsWith("/")) {
    return fileExists(join(distDir, relPath, "index.html"));
  }

  // No extension, no trailing slash → try dir/index.html then .html
  if (await fileExists(join(distDir, relPath, "index.html"))) return true;
  return fileExists(join(distDir, relPath + ".html"));
}

// --- MDX Source Scan ---

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

    // Markdown link syntax: [text](/docs/...) or [text](/ja/docs/...)
    const mdRegex = /\]\((\/(?:ja\/)?docs\/[^)]*)\)/g;
    let match;
    while ((match = mdRegex.exec(line)) !== null) {
      issues.push({ href: match[1], line: i + 1 });
    }

    // JSX href attributes: href="/docs/..." or href="/ja/docs/..."
    const jsxRegex = /href="(\/(?:ja\/)?docs\/[^"]*)"/g;
    while ((match = jsxRegex.exec(line)) !== null) {
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

export async function checkMdxLinks(contentDirs, rootDir) {
  const warnings = [];

  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    const files = await collectFiles(dir, [".mdx", ".md"]);

    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const issues = extractMdxAbsoluteLinks(content);

      for (const { href, line } of issues) {
        warnings.push({ file: relative(rootDir, file), line, href });
      }
    }
  }

  return warnings;
}

// --- Report ---

export function formatReport(brokenLinks, mdxWarnings) {
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

  const total = brokenLinks.length + mdxWarnings.length;
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
    lines.push(`✗ Found ${parts.join(" and ")}`);
  } else {
    lines.push("✓ No broken links or absolute path issues found");
  }

  return lines.join("\n");
}

// --- Main ---

async function main() {
  const rootDir = resolve(__dirname, "..");
  // Config values are fixed to the v4 `zudoDoc({...})` settings in zfb.config.ts
  // (the former src/config/settings.ts was removed in the v4 migration):
  //   base "/", docsDir "src/content/docs", ja locale dir "src/content/docs-ja".
  const basePath = "/";
  const docsDir = "src/content/docs";
  const localeDirs = ["src/content/docs-ja"];
  const distDir = join(rootDir, "dist");

  console.log(`Checking links (base: ${basePath})...\n`);

  if (!(await fileExists(distDir))) {
    console.error("Error: dist/ directory not found. Run 'pnpm build' first.");
    process.exit(1);
  }

  // Exclude versioned docs links — version content may be incomplete
  const excludePatterns = [/\/v\/[^/]+\//];

  const contentDirs = [join(rootDir, docsDir), ...localeDirs.map((d) => join(rootDir, d))];

  const [brokenLinks, mdxWarnings] = await Promise.all([
    checkHtmlLinks(distDir, rootDir, basePath, excludePatterns),
    checkMdxLinks(contentDirs, rootDir),
  ]);

  console.log(formatReport(brokenLinks, mdxWarnings));

  const hasIssues = brokenLinks.length > 0 || mdxWarnings.length > 0;
  const strict = process.argv.includes("--strict");

  if (hasIssues && strict) {
    process.exit(1);
  }
  if (hasIssues && !strict) {
    console.log("\nNote: Issues found but running in non-strict mode (exit 0).");
    console.log("Use --strict to fail on issues.");
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
