/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";

/**
 * Heuristic: does `text` look like a URL, filesystem path, or similar
 * structure where inserting <wbr> after delimiters aids line-wrapping?
 *
 * Returns true for URLs (contain "://"), POSIX-style absolute/relative
 * paths ("/", "./", "../"), Windows drive paths ("C:\\..." or "C:/..."),
 * strings with 2+ slashes (or backslashes) between alphanumerics, and
 * plausible domain-plus-slash strings.
 *
 * Returns false for empty input and prose-y hyphen/slash/dot combinations
 * like "and/or", "well-known", "state-of-the-art", "1.2.3-beta.4", "UI/UX".
 */
export function isPathLike(text: string): boolean {
  if (!text) return false;
  if (text.includes("://")) return true;
  // starts with "/", "./", or "../"
  if (/^\.{0,2}\//.test(text)) return true;
  // Windows drive letter paths, either backslash or forward slash
  if (/^[A-Za-z]:[\\/]/.test(text)) return true;
  // 2+ forward slashes appearing between alphanumeric runs
  const forwardMatches = text.match(/[A-Za-z0-9]\/[A-Za-z0-9]/g);
  if (forwardMatches && forwardMatches.length >= 2) return true;
  // 2+ backslashes appearing between alphanumeric runs
  const backMatches = text.match(/[A-Za-z0-9]\\[A-Za-z0-9]/g);
  if (backMatches && backMatches.length >= 2) return true;
  // Plausible domain-ish: a "." between alphanumerics AND at least one slash
  const hasDomainDot = /[A-Za-z0-9]\.[A-Za-z0-9]/.test(text);
  const hasSlash = /[\\/]/.test(text);
  if (hasDomainDot && hasSlash) return true;
  return false;
}

// Delimiter set: / \ - _ . : ? # & =
// Capture in split so the delimiter is preserved at odd indices.
const DELIM_SPLIT = /([/\\\-_.:?#&=])/;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]!);
}

/**
 * If `text` is path-like, return a Preact fragment with <wbr/> inserted
 * after each delimiter (/, \, -, _, ., :, ?, #, &, =). Otherwise return
 * the input string unchanged so callers can trust non-path prose passes
 * through untouched.
 */
export function smartBreak(text: string): VNode | string {
  if (!isPathLike(text)) return text;
  const parts = text.split(DELIM_SPLIT);
  const nodes: (string | VNode)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (part === "") continue;
    nodes.push(part);
    // Captured delimiter groups always land at odd indices.
    if (i % 2 === 1) nodes.push(<wbr key={`wbr-${i}`} />);
  }
  return <>{nodes}</>;
}

/**
 * Preact function component wrapper — pure, server-renderable.
 * Stringifies children and defers to smartBreak.
 */
export function SmartBreak({ children }: { children?: unknown }): VNode {
  return <>{smartBreak(String(children ?? ""))}</>;
}

/**
 * HTML-escape `text` and inject a literal "<wbr>" tag after every
 * delimiter character. Unlike smartBreakToHtml, this does NOT check
 * isPathLike — it unconditionally breaks on delimiters.
 *
 * Useful when a caller has already decided that a larger string is
 * path-like and wants to apply the same wbr-injection rule to a
 * substring (e.g. a segment produced by splitting on a search-query
 * regex) without re-running the heuristic on fragments that are too
 * short to be classified correctly on their own.
 *
 * Byte-identical to smartBreakToHtml for inputs where isPathLike is
 * true, so the shared contract holds.
 */
export function escapeAndInjectWbr(text: string): string {
  const parts = text.split(DELIM_SPLIT);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (part === "") continue;
    out += htmlEscape(part);
    if (i % 2 === 1) out += "<wbr>";
  }
  return out;
}

/**
 * HTML-string counterpart of smartBreak. Produces a safe HTML string
 * with literal "<wbr>" tags injected after each delimiter in path-like
 * input, and HTML-escaped text elsewhere. For non-path input, returns
 * the HTML-escaped text unchanged (no wbr injection).
 *
 * Use this when the consumer cannot render Preact VNodes (e.g. building
 * an HTML string for `set:html` / dangerouslySetInnerHTML).
 */
export function smartBreakToHtml(text: string): string {
  if (!isPathLike(text)) return htmlEscape(text);
  return escapeAndInjectWbr(text);
}
