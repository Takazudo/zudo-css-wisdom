#!/usr/bin/env node
/**
 * S7 Content Codemod
 * Transforms MDX content for the zcss → zfb migration.
 *
 * Transforms applied to non-generated files in src/content/{docs,docs-ja}:
 *   1. Strip per-file `import CssPreview/TailwindPreview from '@/components/...'` lines
 *   2. Strip `client:load` directives from <CssPreview> / <TailwindPreview> tags
 *   3. Normalize internal relative links to .mdx-extension form
 *   4. Reformat admonitions to CommonMark blank-line directive shape
 *
 * Generated files (frontmatter `generated: true`) are skipped entirely.
 */

import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const CONTENT_ROOTS = [
  'src/content/docs',
  'src/content/docs-ja',
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function walkMdx(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdx(full));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

function isGenerated(content) {
  // Match `generated: true` or `generated:true` in frontmatter
  return /^---[\s\S]*?\ngenerated:\s*true\s*\n[\s\S]*?---/m.test(content);
}

// ─────────────────────────────────────────────
// Transform 1: Strip import lines
// ─────────────────────────────────────────────

function stripImports(content) {
  // Match: import CssPreview from '@/components/CssPreview';
  //        import TailwindPreview from "@/components/TailwindPreview"
  // Also clean up the blank line that immediately follows (if any)
  let changed = 0;
  const result = content.replace(
    /^import\s+(CssPreview|TailwindPreview)\s+from\s+['"]@\/components\/[^'"]+['"]\s*;?\s*\n?/gm,
    () => { changed++; return ''; }
  );
  return { content: result, changed };
}

// ─────────────────────────────────────────────
// Transform 2: Strip client:load
// ─────────────────────────────────────────────

function stripClientLoad(content) {
  // Match `client:load` (with optional surrounding whitespace within JSX attributes)
  // Only strip when it's an attribute on a JSX opening tag line.
  // Safe regex: matches `client:load` followed by whitespace (not inside a string)
  let changed = 0;
  const result = content.replace(/\s+client:load\b/g, () => { changed++; return ''; });
  return { content: result, changed };
}

// ─────────────────────────────────────────────
// Transform 3: Normalize internal links
// ─────────────────────────────────────────────

/**
 * Resolve a relative link `href` from `sourceFile` to a .mdx path.
 * Returns the normalized href, or null if cannot be resolved to a file.
 */
function resolveRelativeLink(href, sourceFile) {
  // Split into path part and anchor
  const anchorIdx = href.indexOf('#');
  let pathPart = anchorIdx >= 0 ? href.slice(0, anchorIdx) : href;
  const anchor = anchorIdx >= 0 ? href.slice(anchorIdx) : '';

  // Skip external, pure-anchor, absolute-path links
  if (!pathPart || pathPart.startsWith('http') || pathPart.startsWith('mailto')) {
    return null;
  }
  // Absolute paths (start with /) — route form, not file-relative; don't touch
  if (pathPart.startsWith('/')) {
    return null;
  }

  // Already has .mdx — check for double-extension risk
  if (pathPart.endsWith('.mdx')) {
    return null; // already normalized
  }

  const sourceDir = path.dirname(sourceFile);
  // Remove trailing slash from path part for resolution
  const normalizedPath = pathPart.replace(/\/+$/, '');

  // Strategy: try .mdx first, then /index.mdx
  const candidates = [
    normalizedPath + '.mdx',         // e.g. ../foo → ../foo.mdx
    normalizedPath + '/index.mdx',   // e.g. ../foo/ → ../foo/index.mdx
  ];

  for (const candidate of candidates) {
    const absoluteCandidate = path.resolve(sourceDir, candidate);
    if (fs.existsSync(absoluteCandidate)) {
      // Return the relative form with .mdx
      return candidate + anchor;
    }
  }

  // Could not resolve — log and leave unchanged
  if (VERBOSE) {
    console.log(`  [link unresolved] ${pathPart} in ${sourceFile}`);
  }
  return null;
}

function normalizeLinks(content, sourceFile) {
  // We need to skip links inside:
  //   - Fenced code blocks (``` ... ```)
  //   - Inline code (`...`)
  // Strategy: split content into segments (code vs prose) and only process prose

  let changed = 0;

  // Build a list of [start, end] ranges that are inside code blocks or inline code
  const codeRanges = [];

  // Fenced code blocks
  let fenceRe = /^```[\s\S]*?^```/gm;
  let m;
  while ((m = fenceRe.exec(content)) !== null) {
    codeRanges.push([m.index, m.index + m[0].length]);
  }

  // Inline code (backtick spans, non-greedy)
  let inlineRe = /`[^`\n]+`/g;
  while ((m = inlineRe.exec(content)) !== null) {
    codeRanges.push([m.index, m.index + m[0].length]);
  }

  function isInCode(pos) {
    return codeRanges.some(([start, end]) => pos >= start && pos < end);
  }

  // Match markdown links: [text](href)
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let result = '';
  let lastIdx = 0;

  while ((m = linkRe.exec(content)) !== null) {
    const matchStart = m.index;

    // Skip if inside code
    if (isInCode(matchStart)) {
      result += content.slice(lastIdx, m.index + m[0].length);
      lastIdx = m.index + m[0].length;
      continue;
    }

    const text = m[1];
    const href = m[2];

    const newHref = resolveRelativeLink(href, sourceFile);
    result += content.slice(lastIdx, matchStart);

    if (newHref !== null) {
      result += `[${text}](${newHref})`;
      changed++;
    } else {
      result += m[0];
    }
    lastIdx = matchStart + m[0].length;
  }
  result += content.slice(lastIdx);

  return { content: result, changed };
}

// ─────────────────────────────────────────────
// Transform 4: Fix admonition blank lines
// ─────────────────────────────────────────────

/**
 * Ensure blank lines before and after ::: directives.
 * Skip directives inside fenced code blocks.
 */
function fixAdmonitions(content) {
  let changed = 0;

  // Split into lines and track fence state
  const lines = content.split('\n');
  const newLines = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Track fence state
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
    }

    if (!inFence && /^:::/.test(trimmed)) {
      // Check if previous line is blank (empty or only whitespace)
      const prevLine = newLines.length > 0 ? newLines[newLines.length - 1] : null;
      if (prevLine !== null && prevLine.trim() !== '') {
        newLines.push('');
        changed++;
      }

      newLines.push(line);

      // Check if next line is blank
      const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
      if (nextLine !== null && nextLine.trim() !== '') {
        newLines.push('');
        changed++;
      }
    } else {
      newLines.push(line);
    }
  }

  return { content: newLines.join('\n'), changed };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const stats = {
  totalFiles: 0,
  generatedSkipped: 0,
  filesChanged: 0,
  importsStripped: 0,
  clientLoadStripped: 0,
  linksNormalized: 0,
  admonitionsFixed: 0,
  changedFiles: [],
};

for (const root of CONTENT_ROOTS) {
  const files = walkMdx(root);

  for (const file of files) {
    stats.totalFiles++;
    let content = fs.readFileSync(file, 'utf8');

    if (isGenerated(content)) {
      stats.generatedSkipped++;
      continue;
    }

    const original = content;
    const fileStats = { imports: 0, clientLoad: 0, links: 0, admonitions: 0 };

    // Transform 1: strip imports
    {
      const r = stripImports(content);
      content = r.content;
      fileStats.imports += r.changed;
    }

    // Transform 2: strip client:load
    {
      const r = stripClientLoad(content);
      content = r.content;
      fileStats.clientLoad += r.changed;
    }

    // Transform 3: normalize links
    {
      const r = normalizeLinks(content, file);
      content = r.content;
      fileStats.links += r.changed;
    }

    // Transform 4: fix admonitions
    {
      const r = fixAdmonitions(content);
      content = r.content;
      fileStats.admonitions += r.changed;
    }

    if (content !== original) {
      stats.filesChanged++;
      stats.importsStripped += fileStats.imports;
      stats.clientLoadStripped += fileStats.clientLoad;
      stats.linksNormalized += fileStats.links;
      stats.admonitionsFixed += fileStats.admonitions;
      stats.changedFiles.push({
        file,
        imports: fileStats.imports,
        clientLoad: fileStats.clientLoad,
        links: fileStats.links,
        admonitions: fileStats.admonitions,
      });

      if (!DRY_RUN) {
        fs.writeFileSync(file, content, 'utf8');
      }
    }
  }
}

// ─────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────

console.log('\n=== S7 Content Codemod Report ===\n');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'}`);
console.log(`Total .mdx files scanned: ${stats.totalFiles}`);
console.log(`Generated (skipped): ${stats.generatedSkipped}`);
console.log(`Real files processed: ${stats.totalFiles - stats.generatedSkipped}`);
console.log(`Files changed: ${stats.filesChanged}`);
console.log('');
console.log('Transform totals:');
console.log(`  Imports stripped:         ${stats.importsStripped}`);
console.log(`  client:load stripped:     ${stats.clientLoadStripped}`);
console.log(`  Links normalized:         ${stats.linksNormalized}`);
console.log(`  Admonition blank lines:   ${stats.admonitionsFixed}`);
console.log('');

if (VERBOSE || stats.changedFiles.length <= 30) {
  console.log('Changed files:');
  for (const { file, imports, clientLoad, links, admonitions } of stats.changedFiles) {
    const parts = [];
    if (imports) parts.push(`imports:${imports}`);
    if (clientLoad) parts.push(`client:load:${clientLoad}`);
    if (links) parts.push(`links:${links}`);
    if (admonitions) parts.push(`admonitions:${admonitions}`);
    console.log(`  ${file} [${parts.join(', ')}]`);
  }
}
