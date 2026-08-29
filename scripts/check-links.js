#!/usr/bin/env node

/**
 * Check links in a generated zudo-doc project.
 *
 * The source scan is intentionally useful before a build: generated projects
 * do not need a dist/ directory for anchor validation. When dist/ exists, its
 * HTML is checked as an additional pass.
 */

import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractHeadings, slugify } from "@takazudo/zudo-doc/extract-headings";

const CLI_USAGE = `Usage: pnpm check:links -- [options]

Options:
  -h, --help           Show this help
  --strict-broken      Fail when broken links remain after the allowlist
  --strict-absolute    Fail when absolute MDX links remain after the allowlist
  --strict-anchors     Fail when invalid anchors remain after the allowlist
  --strict-trailing    Fail when trailing-slash warnings remain after the allowlist
  --allowlist=PATH     Exclude exact <file>:<line>:<href> entries from failure counts`;

class CliArgumentError extends Error {}

function parseCliArgs(argv) {
  const result = {
    help: false,
    strictBroken: false,
    strictAbsolute: false,
    strictAnchors: false,
    strictTrailing: false,
    allowlistPath: null,
  };

  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "-h" || arg === "--help") result.help = true;
    else if (arg === "--strict-broken") result.strictBroken = true;
    else if (arg === "--strict-absolute") result.strictAbsolute = true;
    else if (arg === "--strict-anchors") result.strictAnchors = true;
    else if (arg === "--strict-trailing") result.strictTrailing = true;
    else if (arg.startsWith("--allowlist=")) {
      result.allowlistPath = arg.slice("--allowlist=".length);
      if (!result.allowlistPath) {
        throw new CliArgumentError("--allowlist requires a non-empty path");
      }
    } else {
      throw new CliArgumentError(`Unknown option: ${arg}\n\n${CLI_USAGE}`);
    }
  }
  return result;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath) {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function collectFiles(dir, extensions) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(full);
      }
    }
  }
  await walk(dir);
  return files.sort();
}

// ---------------------------------------------------------------------------
// zfb.config.ts literal extraction
// ---------------------------------------------------------------------------

function skipTrivia(source, index, end = source.length) {
  let cursor = index;
  while (cursor < end) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 || newline >= end ? end : newline + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close === -1 || close + 2 > end) {
        throw new Error("unterminated block comment");
      }
      cursor = close + 2;
      continue;
    }
    break;
  }
  return cursor;
}

function readStringEnd(source, start, end = source.length) {
  const quote = source[start];
  if (quote !== "\"" && quote !== "'") return null;
  let cursor = start + 1;
  while (cursor < end) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  throw new Error("unterminated string literal");
}

function readStringValue(source, start, end, fieldName) {
  const valueStart = skipTrivia(source, start, end);
  const valueEnd = readStringEnd(source, valueStart, end);
  if (valueEnd === null || skipTrivia(source, valueEnd, end) !== end) {
    throw new Error(
      `zfb.config.ts field ${fieldName} must be a literal string (dynamic expressions are not supported)`,
    );
  }
  const raw = source.slice(valueStart, valueEnd);
  try {
    if (raw[0] === '"') return JSON.parse(raw);
    // Generated configs use JSON strings, but accepting ordinary single-
    // quoted TypeScript literals makes the extractor useful for hand edits.
    let result = "";
    for (let i = 1; i < raw.length - 1; i += 1) {
      if (raw[i] !== "\\") {
        result += raw[i];
        continue;
      }
      const escaped = raw[++i];
      const escapes = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        v: "\v",
        "0": "\0",
        "\\": "\\",
        "'": "'",
        '"': '"',
      };
      if (escaped === "u") {
        const hex = raw.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("invalid unicode escape");
        result += String.fromCharCode(Number.parseInt(hex, 16));
        i += 4;
      } else if (escaped === "x") {
        const hex = raw.slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error("invalid hex escape");
        result += String.fromCharCode(Number.parseInt(hex, 16));
        i += 2;
      } else if (escaped in escapes) result += escapes[escaped];
      else throw new Error(`unsupported escape \\${escaped}`);
    }
    return result;
  } catch (error) {
    throw new Error(`zfb.config.ts field ${fieldName} has an invalid string literal: ${error.message}`);
  }
}

function matchingDelimiter(source, start, end = source.length) {
  const opening = source[start];
  const pairs = { "{": "}", "[": "]", "(": ")" };
  if (!(opening in pairs)) throw new Error(`expected an object/array/call at offset ${start}`);
  const stack = [pairs[opening]];
  let cursor = start + 1;
  while (cursor < end) {
    if (source[cursor] === "\"" || source[cursor] === "'") {
      cursor = readStringEnd(source, cursor, end);
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 || newline >= end ? end : newline + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close === -1 || close + 2 > end) throw new Error("unterminated block comment");
      cursor = close + 2;
      continue;
    }
    if (source[cursor] in pairs) stack.push(pairs[source[cursor]]);
    else if (source[cursor] === stack.at(-1)) stack.pop();
    else if (source[cursor] === "}" || source[cursor] === "]" || source[cursor] === ")") {
      throw new Error(`unexpected delimiter ${source[cursor]} in zfb.config.ts`);
    }
    if (stack.length === 0) return cursor;
    cursor += 1;
  }
  throw new Error("unterminated literal in zfb.config.ts");
}

function valueEndAtComma(source, start, end) {
  const stack = [];
  let cursor = start;
  while (cursor < end) {
    if (source[cursor] === "\"" || source[cursor] === "'") {
      cursor = readStringEnd(source, cursor, end);
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 || newline >= end ? end : newline + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close === -1 || close + 2 > end) throw new Error("unterminated block comment");
      cursor = close + 2;
      continue;
    }
    if (source[cursor] === "{" || source[cursor] === "[" || source[cursor] === "(") {
      stack.push(source[cursor]);
      cursor += 1;
      continue;
    }
    if (source[cursor] === "}" || source[cursor] === "]" || source[cursor] === ")") {
      if (stack.length === 0) return cursor;
      stack.pop();
      cursor += 1;
      continue;
    }
    if (source[cursor] === "," && stack.length === 0) return cursor;
    cursor += 1;
  }
  return end;
}

function parseObjectEntries(source, open, close, context) {
  const entries = new Map();
  let cursor = open + 1;
  while (true) {
    cursor = skipTrivia(source, cursor, close);
    if (cursor >= close) break;
    if (source.startsWith("...", cursor)) {
      throw new Error(
        `zfb.config.ts ${context} contains a spread; config fields must be literal values`,
      );
    }
    let key;
    if (source[cursor] === "\"" || source[cursor] === "'") {
      const keyEnd = readStringEnd(source, cursor, close);
      key = readStringValue(source, cursor, keyEnd, `${context} key`);
      cursor = keyEnd;
    } else {
      const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(cursor, close));
      if (!match) throw new Error(`zfb.config.ts ${context} has an invalid property name`);
      key = match[0];
      cursor += key.length;
    }
    cursor = skipTrivia(source, cursor, close);
    if (source[cursor] !== ":") {
      const literalKind = key === "base" || key === "docsDir" ? "literal string" : "literal value";
      throw new Error(`zfb.config.ts field ${key} must be a ${literalKind} (dynamic expressions are not supported)`);
    }
    const valueStart = cursor + 1;
    const comma = valueEndAtComma(source, valueStart, close);
    const previous = entries.get(key);
    if (previous !== undefined) throw new Error(`zfb.config.ts declares ${context}.${key} more than once`);
    entries.set(key, { start: valueStart, end: comma });
    cursor = comma;
    if (cursor < close && source[cursor] === ",") cursor += 1;
    else if (cursor < close) throw new Error(`zfb.config.ts ${context} has an invalid separator`);
  }
  return entries;
}

function readLiteralBoolean(source, start, end, fieldName) {
  const valueStart = skipTrivia(source, start, end);
  for (const [literal, value] of [["true", true], ["false", false]]) {
    const literalEnd = valueStart + literal.length;
    if (source.slice(valueStart, literalEnd) === literal && skipTrivia(source, literalEnd, end) === end) {
      return value;
    }
  }
  throw new Error(
    `zfb.config.ts field ${fieldName} must be the literal true or false (dynamic expressions are not supported)`,
  );
}

function readObjectValue(source, start, end, fieldName) {
  const valueStart = skipTrivia(source, start, end);
  if (source[valueStart] !== "{") {
    throw new Error(`zfb.config.ts field ${fieldName} must be a literal object`);
  }
  const valueClose = matchingDelimiter(source, valueStart, end);
  if (skipTrivia(source, valueClose + 1, end) !== end) {
    throw new Error(`zfb.config.ts field ${fieldName} must be a literal object (dynamic expressions are not supported)`);
  }
  return { open: valueStart, close: valueClose };
}

function findZudoDocCall(source) {
  let cursor = 0;
  let found = null;
  while (cursor < source.length) {
    if (source[cursor] === "\"" || source[cursor] === "'") {
      cursor = readStringEnd(source, cursor);
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close === -1) throw new Error("unterminated block comment in zfb.config.ts");
      cursor = close + 2;
      continue;
    }
    if (source.startsWith("zudoDoc", cursor) && !/[A-Za-z0-9_$]/.test(source[cursor - 1] ?? "")) {
      const afterName = cursor + "zudoDoc".length;
      if (!/[A-Za-z0-9_$]/.test(source[afterName] ?? "")) {
        const openParen = skipTrivia(source, afterName);
        if (source[openParen] === "(") {
          if (found !== null) throw new Error("zfb.config.ts must contain exactly one zudoDoc({...}) call");
          found = openParen;
          cursor = openParen + 1;
          continue;
        }
      }
    }
    cursor += 1;
  }
  return found;
}

export async function parseZfbConfig(configPath) {
  const source = await readFile(configPath, "utf-8");
  const openParen = findZudoDocCall(source);
  if (openParen === null) throw new Error("zfb.config.ts does not contain a zudoDoc({...}) call");
  const closeParen = matchingDelimiter(source, openParen);
  const objectOpen = skipTrivia(source, openParen + 1, closeParen);
  if (source[objectOpen] !== "{") {
    throw new Error("zfb.config.ts zudoDoc() argument must be a literal object (imports and spreads are not supported)");
  }
  const objectClose = matchingDelimiter(source, objectOpen, closeParen);
  if (skipTrivia(source, objectClose + 1, closeParen) !== closeParen) {
    throw new Error("zfb.config.ts zudoDoc() accepts one literal object argument");
  }

  const entries = parseObjectEntries(source, objectOpen, objectClose, "zudoDoc({...})");
  const result = {
    basePath: "/",
    trailingSlash: false,
    docsDir: "src/content/docs",
    localeDirs: [],
    localeKeys: [],
  };

  const base = entries.get("base");
  if (base) result.basePath = readStringValue(source, base.start, base.end, "base");
  const trailing = entries.get("trailingSlash");
  if (trailing) result.trailingSlash = readLiteralBoolean(source, trailing.start, trailing.end, "trailingSlash");
  const docsDir = entries.get("docsDir");
  if (docsDir) result.docsDir = readStringValue(source, docsDir.start, docsDir.end, "docsDir");

  const locales = entries.get("locales");
  if (locales) {
    const localeObject = readObjectValue(source, locales.start, locales.end, "locales");
    const localeEntries = parseObjectEntries(source, localeObject.open, localeObject.close, "locales");
    for (const [key, value] of localeEntries) {
      const localeConfig = readObjectValue(source, value.start, value.end, `locales.${key}`);
      const localeFields = parseObjectEntries(source, localeConfig.open, localeConfig.close, `locales.${key}`);
      const dir = localeFields.get("dir");
      if (!dir) {
        throw new Error(`zfb.config.ts field locales.${key}.dir is required for link checking`);
      }
      result.localeKeys.push(key);
      result.localeDirs.push(readStringValue(source, dir.start, dir.end, `locales.${key}.dir`));
    }
  }
  return result;
}

export async function parseBasePath(configPath) {
  return (await parseZfbConfig(configPath)).basePath;
}

export async function parseTrailingSlash(configPath) {
  return (await parseZfbConfig(configPath)).trailingSlash;
}

export async function parseContentDirs(configPath) {
  const config = await parseZfbConfig(configPath);
  return {
    docsDir: config.docsDir,
    localeDirs: config.localeDirs,
    localeKeys: config.localeKeys,
  };
}

// ---------------------------------------------------------------------------
// Shared link and anchor logic
// ---------------------------------------------------------------------------

export function extractHtmlLinks(html) {
  const links = [];
  // zfb's production minifier emits unquoted attributes. Keep this scaffold
  // compatibility patch until zudolab/zudo-doc#3720 is released upstream.
  const regex = /<a\s[^>]*?href=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`\\]+))[^>]*>/gi;
  let match;
  let lastIndex = 0;
  let line = 1;
  while ((match = regex.exec(html)) !== null) {
    const href = decodeHtmlAttribute(match[1] ?? match[2] ?? match[3]);
    if (/^(?:https?:|\/\/|mailto:|javascript:|data:|tel:)/i.test(href)) continue;
    for (let i = lastIndex; i < match.index; i += 1) if (html[i] === "\n") line += 1;
    lastIndex = match.index;
    links.push({ href, line });
  }
  return links;
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function safeDecodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function parseHref(href) {
  const hashAt = href.indexOf("#");
  const beforeFragment = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = beforeFragment.indexOf("?");
  const rawPath = queryAt === -1 ? beforeFragment : beforeFragment.slice(0, queryAt);
  const rawFragment = hashAt === -1 ? null : href.slice(hashAt + 1);
  if (rawFragment === null) return { path: safeDecodePath(rawPath), fragment: null, fragmentError: null };
  if (rawFragment === "") return { path: safeDecodePath(rawPath), fragment: "", fragmentError: "empty fragment" };
  try {
    return { path: safeDecodePath(rawPath), fragment: decodeURIComponent(rawFragment), fragmentError: null };
  } catch {
    return { path: safeDecodePath(rawPath), fragment: rawFragment, fragmentError: "malformed percent-encoding" };
  }
}

function stripInlineCode(line) {
  let result = line.replace(/(?<!\\)``[^`]*(?:``|$)/g, (match) => " ".repeat(match.length));
  return result.replace(/(?<!\\)`[^`]*(?:`|$)/g, (match) => " ".repeat(match.length));
}

function assertLocaleList(locales) {
  if (!Array.isArray(locales) || !locales.every((locale) => typeof locale === "string")) {
    throw new TypeError("locales must be passed explicitly as an array of locale keys");
  }
}

export function extractMdxAbsoluteLinks(content, locales) {
  assertLocaleList(locales);
  const localeAlternation = locales.length > 0
    ? `(?:${locales.map((key) => `${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`).join("|")})?`
    : "";
  const issues = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const searchLine = stripInlineCode(line);
    const mdRegex = new RegExp(`\\]\\((\\/${localeAlternation}docs\\/[^)]*)\\)`, "g");
    let match;
    while ((match = mdRegex.exec(searchLine)) !== null) issues.push({ href: match[1], line: i + 1 });
    const jsxRegex = new RegExp(`href="(\\/${localeAlternation}docs\\/[^"]*)"`, "g");
    while ((match = jsxRegex.exec(searchLine)) !== null) issues.push({ href: match[1], line: i + 1 });
  }
  return issues;
}

export function extractMdxFragmentLinks(content) {
  const links = [];
  const lines = content.split("\n");
  let codeFenceOpener = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (fence[0] === codeFenceOpener[0] && fence.length >= codeFenceOpener.length) codeFenceOpener = null;
      continue;
    }
    if (codeFenceOpener !== null) continue;
    const searchLine = stripInlineCode(line);
    let match;
    const markdownLink = /\]\(\s*([^\s)#]*#[^\s)]*)(?:\s+[^)]*)?\)/g;
    while ((match = markdownLink.exec(searchLine)) !== null) {
      if (!/^(?:https?:|mailto:|javascript:|data:|tel:)/i.test(match[1])) links.push({ href: match[1], line: i + 1 });
    }
    const jsxHref = /\bhref\s*=\s*(?:"([^"]*#[^"]*)"|'([^']*#[^']*)')/g;
    while ((match = jsxHref.exec(searchLine)) !== null) {
      const href = match[1] ?? match[2];
      if (!/^(?:https?:|mailto:|javascript:|data:|tel:)/i.test(href)) links.push({ href, line: i + 1 });
    }
  }
  return links;
}

function headingText(raw) {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<![\w])__([^_]+)__(?![\w])/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(?<![\w])_([^_]+)_(?![\w])/g, "$1")
    .trim();
}

function allHierarchicalHeadingIds(body) {
  const ids = new Set(extractHeadings(body).map((heading) => heading.slug));
  const seen = new Map();
  const stack = [];
  let codeFenceOpener = null;
  for (const line of body.split("\n")) {
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (fence[0] === codeFenceOpener[0] && fence.length >= codeFenceOpener.length) codeFenceOpener = null;
      continue;
    }
    if (codeFenceOpener !== null) continue;
    const match = /^(#{2,6})[ \t]+(.+)$/.exec(line.trim());
    if (match === null) continue;
    const depth = match[1].length;
    const base = slugify(headingText(match[2]));
    if (base === "") continue;
    while ((stack.at(-1)?.depth ?? -1) >= depth) stack.pop();
    const parent = stack.at(-1);
    const candidate = parent === undefined ? base : `${parent.id}-${base}`;
    const count = seen.get(candidate) ?? 0;
    seen.set(candidate, count + 1);
    const id = count === 0 ? candidate : `${candidate}-${count}`;
    stack.push({ depth, id });
    ids.add(id);
  }
  return ids;
}

function extractStaticMdxIds(body) {
  const ids = new Set();
  let codeFenceOpener = null;
  const visibleLines = [];
  for (const line of body.split("\n")) {
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (fence[0] === codeFenceOpener[0] && fence.length >= codeFenceOpener.length) codeFenceOpener = null;
      visibleLines.push("");
      continue;
    }
    visibleLines.push(codeFenceOpener === null ? stripInlineCode(line) : "");
  }
  const elements = visibleLines.join("\n");
  const regex = /<[A-Za-z][^>]*\bid\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gs;
  let match;
  while ((match = regex.exec(elements)) !== null) ids.add(match[1] ?? match[2]);
  return ids;
}

async function resolveMdxTarget(sourceFile, href, contentDirs, locales, basePath) {
  const { path: decodedPath } = parseHref(href);
  let rawPath = decodedPath;
  if (basePath !== "/" && rawPath.startsWith(basePath)) rawPath = "/" + rawPath.slice(basePath.length);
  let target;
  if (rawPath === "") target = sourceFile;
  else if (rawPath.startsWith("/docs/")) target = resolve(contentDirs[0], rawPath.slice("/docs/".length));
  else {
    const locale = locales.find((key) => rawPath.startsWith(`/${key}/docs/`));
    if (locale !== undefined) {
      const localeDir = contentDirs[locales.indexOf(locale) + 1];
      if (localeDir === undefined) return null;
      target = resolve(localeDir, rawPath.slice(`/${locale}/docs/`.length));
    } else if (rawPath.startsWith("/")) return null;
    else target = resolve(dirname(sourceFile), rawPath);
  }
  const candidates = extname(target)
    ? [target]
    : [target, `${target}.mdx`, `${target}.md`, resolve(target, "index.mdx"), resolve(target, "index.md")];
  for (const candidate of candidates) {
    if (await fileExists(candidate) && (await stat(candidate)).isFile()) return candidate;
  }
  return null;
}

export async function checkMdxAnchors(contentDirs, rootDir, basePath = "/", locales, excludePatterns = []) {
  assertLocaleList(locales);
  const anchors = [];
  const idCache = new Map();
  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    for (const file of await collectFiles(dir, [".mdx", ".md"])) {
      const content = await readFile(file, "utf-8");
      for (const { href, line } of extractMdxFragmentLinks(content)) {
        if (excludePatterns.some((pattern) => pattern.test(href))) continue;
        const parsed = parseHref(href);
        if (parsed.fragmentError !== null) {
          anchors.push({ file: relative(rootDir, file), line, href, fragment: parsed.fragment, reason: parsed.fragmentError });
          continue;
        }
        const target = await resolveMdxTarget(file, href, contentDirs, locales, basePath);
        if (target === null) continue;
        let ids = idCache.get(target);
        if (ids === undefined) {
          const targetBody = await readFile(target, "utf-8");
          ids = allHierarchicalHeadingIds(targetBody);
          for (const id of extractStaticMdxIds(targetBody)) ids.add(id);
          idCache.set(target, ids);
        }
        if (!ids.has(parsed.fragment)) anchors.push({ file: relative(rootDir, file), line, href, fragment: parsed.fragment, reason: "missing target id" });
      }
    }
  }
  return anchors;
}

async function resolveDistTarget(href, distDir, basePath = "/", fileDir = "", sourceFile = null) {
  const { path: clean, fragment, fragmentError } = parseHref(href);
  if (!clean) return { type: "root", targetFile: sourceFile ?? join(distDir, "index.html"), fragment, fragmentError };
  let absolute = clean;
  if (!clean.startsWith("/")) absolute = "/" + join(fileDir ? relative(distDir, fileDir) : "", clean);
  let stripped = absolute;
  if (basePath !== "/" && stripped.startsWith(basePath)) stripped = "/" + stripped.slice(basePath.length);
  const relPath = stripped.startsWith("/") ? stripped.slice(1) : stripped;
  if (!relPath) return { type: "root", targetFile: join(distDir, "index.html"), fragment, fragmentError };
  if (extname(relPath)) {
    const targetFile = join(distDir, relPath);
    return { type: (await fileExists(targetFile)) ? "file" : "missing", targetFile, fragment, fragmentError };
  }
  const indexFile = join(distDir, relPath, "index.html");
  if (await fileExists(indexFile)) return { type: "directoryIndex", targetFile: indexFile, fragment, fragmentError };
  const htmlFile = join(distDir, relPath + ".html");
  if (await fileExists(htmlFile)) return { type: "file", targetFile: htmlFile, fragment, fragmentError };
  return { type: "missing", targetFile: null, fragment, fragmentError };
}

export async function resolveLinkDetail(href, distDir, basePath = "/", fileDir = "") {
  return (await resolveDistTarget(href, distDir, basePath, fileDir)).type;
}

export async function resolveLink(href, distDir, basePath = "/", fileDir = "") {
  return (await resolveDistTarget(href, distDir, basePath, fileDir)).type !== "missing";
}

export async function checkHtmlLinksAndTrailing(
  distDir,
  rootDir,
  basePath = "/",
  excludePatterns = [],
  checkTrailing = false,
) {
  const broken = [];
  const anchors = [];
  const trailingSlash = [];
  const idCache = new Map();
  const cache = new Map();
  for (const file of await collectFiles(distDir, [".html"])) {
    const content = await readFile(file, "utf-8");
    for (const { href, line } of extractHtmlLinks(content)) {
      if (excludePatterns.some((pattern) => pattern.test(href))) continue;
      const cacheKey = href.startsWith("/") ? href : `${file}:${href}`;
      let detail = cache.get(cacheKey);
      if (detail === undefined) {
        detail = await resolveDistTarget(href, distDir, basePath, dirname(file), file);
        cache.set(cacheKey, detail);
      }
      if (detail.type === "missing") broken.push({ file: relative(rootDir, file), line, href });
      if (detail.fragment !== null) {
        let reason = detail.fragmentError;
        if (reason === null && detail.type !== "missing" && detail.targetFile !== null && extname(detail.targetFile) === ".html") {
          let ids = idCache.get(detail.targetFile);
          if (ids === undefined) {
            const targetHtml = await readFile(detail.targetFile, "utf-8");
            ids = new Set();
            const idRegex = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`\\]+))/gi;
            let idMatch;
            while ((idMatch = idRegex.exec(targetHtml)) !== null) {
              ids.add(decodeHtmlAttribute(idMatch[1] ?? idMatch[2] ?? idMatch[3]));
            }
            idCache.set(detail.targetFile, ids);
          }
          if (!ids.has(detail.fragment)) reason = "missing target id";
        }
        if (reason !== null) anchors.push({ file: relative(rootDir, file), line, href, fragment: detail.fragment, reason });
      }
      if (checkTrailing) {
        const pathPart = href.split("#")[0].split("?")[0];
        if (pathPart && pathPart !== "/" && pathPart !== "." && pathPart !== "./" && !pathPart.endsWith("/") && !extname(pathPart) && detail.type === "directoryIndex") {
          trailingSlash.push({ file: relative(rootDir, file), line, href });
        }
      }
    }
  }
  return { broken, anchors, trailingSlash };
}

export async function checkMdxLinks(
  contentDirs,
  rootDir,
  distDir = null,
  basePath = "/",
  locales = [],
) {
  assertLocaleList(locales);
  const warnings = [];
  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    for (const file of await collectFiles(dir, [".mdx", ".md"])) {
      const content = await readFile(file, "utf-8");
      for (const { href, line } of extractMdxAbsoluteLinks(content, locales)) {
        if (distDir && await resolveLink(href, distDir, basePath)) continue;
        warnings.push({ file: relative(rootDir, file), line, href });
      }
    }
  }
  return warnings;
}

export function formatReport(brokenLinks, mdxWarnings, trailingSlashWarnings = [], anchorWarnings = []) {
  const lines = [];
  const section = (title, entries, format) => {
    if (entries.length === 0) return;
    lines.push(title);
    for (const entry of entries) lines.push(`  ${format(entry)}`);
    lines.push("");
  };
  section("=== Broken Links in Built HTML ===", brokenLinks, (e) => `${e.file}:${e.line}  ${e.href}`);
  section("=== Absolute Links Bypassing Base Path (MDX Source) ===", mdxWarnings, (e) => `${e.file}:${e.line}  ${e.href}`);
  section("=== Links Missing Trailing Slash ===", trailingSlashWarnings, (e) => `${e.file}:${e.line}  ${e.href}`);
  section("=== Invalid Anchors ===", anchorWarnings, (e) => `${e.file}:${e.line}  ${e.href}  (fragment: #${e.fragment}; ${e.reason})`);
  const total = brokenLinks.length + mdxWarnings.length + trailingSlashWarnings.length + anchorWarnings.length;
  if (total === 0) lines.push("✓ No broken links, invalid anchors, or absolute path issues found");
  else {
    const parts = [];
    if (brokenLinks.length) parts.push(`${brokenLinks.length} broken link${brokenLinks.length === 1 ? "" : "s"}`);
    if (mdxWarnings.length) parts.push(`${mdxWarnings.length} absolute path warning${mdxWarnings.length === 1 ? "" : "s"}`);
    if (trailingSlashWarnings.length) parts.push(`${trailingSlashWarnings.length} trailing slash warning${trailingSlashWarnings.length === 1 ? "" : "s"}`);
    if (anchorWarnings.length) parts.push(`${anchorWarnings.length} invalid anchor${anchorWarnings.length === 1 ? "" : "s"}`);
    lines.push(`✗ Found ${parts.join(" and ")}`);
  }
  return lines.join("\n");
}

export async function readAllowlist(allowlistPath) {
  if (!allowlistPath || !(await fileExists(allowlistPath))) return new Set();
  return new Set((await readFile(allowlistPath, "utf-8")).split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")));
}

function entryKey(entry) {
  return `${entry.file}:${entry.line}:${entry.href}`;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(CLI_USAGE);
    return;
  }
  const rootDir = resolve(process.cwd());
  const configPath = join(rootDir, "zfb.config.ts");
  const config = await parseZfbConfig(configPath);
  const contentDirs = [resolve(rootDir, config.docsDir), ...config.localeDirs.map((dir) => resolve(rootDir, dir))];
  const distDir = join(rootDir, "dist");
  const hasDist = await isDirectory(distDir);
  const excludePatterns = [/\/v\/[^/]+\//];
  console.log(`Checking links (base: ${config.basePath}, trailingSlash: ${config.trailingSlash})...`);
  console.log(`Source scan: ${contentDirs.map((dir) => relative(rootDir, dir) || ".").join(", ")}${hasDist ? "; dist/ pass enabled" : "; dist/ absent (source-only)"}\n`);

  const [{ broken, anchors: htmlAnchors, trailingSlash }, mdxWarnings, mdxAnchors] = await Promise.all([
    hasDist ? checkHtmlLinksAndTrailing(distDir, rootDir, config.basePath, excludePatterns, config.trailingSlash) : Promise.resolve({ broken: [], anchors: [], trailingSlash: [] }),
    checkMdxLinks(contentDirs, rootDir, hasDist ? distDir : null, config.basePath, config.localeKeys),
    checkMdxAnchors(contentDirs, rootDir, config.basePath, config.localeKeys, excludePatterns),
  ]);
  const anchorWarnings = [...htmlAnchors, ...mdxAnchors];
  const allowlistPath = options.allowlistPath ? (options.allowlistPath.startsWith("/") ? options.allowlistPath : join(rootDir, options.allowlistPath)) : null;
  const allowlist = await readAllowlist(allowlistPath);
  const filter = (entries) => entries.filter((entry) => !allowlist.has(entryKey(entry)));
  const realBroken = filter(broken);
  const realAbsolute = filter(mdxWarnings);
  const realAnchors = filter(anchorWarnings);
  const realTrailing = filter(trailingSlash);
  console.log(formatReport(broken, mdxWarnings, trailingSlash, anchorWarnings));
  const skipped = broken.length - realBroken.length + mdxWarnings.length - realAbsolute.length + anchorWarnings.length - realAnchors.length + trailingSlash.length - realTrailing.length;
  if (skipped > 0) console.log(`\nAllowlist: ${skipped} known exception${skipped === 1 ? "" : "s"} excluded from strict-mode counts (${allowlistPath}).`);
  let failed = false;
  if (options.strictBroken && realBroken.length) { console.log(`\n❌ STRICT FAIL: ${realBroken.length} broken link${realBroken.length === 1 ? "" : "s"} (after allowlist).`); failed = true; }
  if (options.strictAbsolute && realAbsolute.length) { console.log(`\n❌ STRICT FAIL: ${realAbsolute.length} absolute MDX-source link${realAbsolute.length === 1 ? "" : "s"} (after allowlist).`); failed = true; }
  if (options.strictAnchors && realAnchors.length) { console.log(`\n❌ STRICT FAIL: ${realAnchors.length} invalid anchor${realAnchors.length === 1 ? "" : "s"} (after allowlist).`); failed = true; }
  if (options.strictTrailing && realTrailing.length) { console.log(`\n❌ STRICT FAIL: ${realTrailing.length} trailing-slash warning${realTrailing.length === 1 ? "" : "s"} (after allowlist).`); failed = true; }
  if (failed) process.exitCode = 1;
  else if ((broken.length || mdxWarnings.length || anchorWarnings.length || trailingSlash.length) && !options.strictBroken && !options.strictAbsolute && !options.strictAnchors && !options.strictTrailing) {
    console.log("\nNote: Issues found but running in non-strict mode (exit 0).");
    console.log("Use --strict-broken / --strict-absolute / --strict-anchors / --strict-trailing to fail on selected issue categories.");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof CliArgumentError ? error.message : error);
    process.exitCode = 1;
  });
}
