#!/usr/bin/env node

/**
 * check-nav-labels.mjs — guard the localized header-nav label mechanism (#203).
 *
 * `HeaderNavItem`/`HeaderNavChildItem` support a `labelKey` that, when present,
 * is resolved through `translations` instead of the hardcoded `label` string
 * (`renderNavItem` in `@takazudo/zudo-doc/dist/header/header.js`). But
 * `t(key, locale)` resolves locale → default locale → **the raw key itself**
 * (`@takazudo/zudo-doc/dist/route-context/index.js`) — it never throws. So a
 * `labelKey` with no matching `translations.en`/`translations.ja` entry does
 * not fail the build; it silently renders a literal `nav.layout` in the
 * header. Nothing else (typecheck, `zfb build`, html-validate, link check)
 * can see that failure mode — hence this dedicated source-level check.
 *
 * Parsing strategy mirrors check-category-meta.mjs: `zfb.config.ts` is
 * scanned as text, not executed — it imports `zfb/config`, which this
 * plain-Node script does not resolve. `translations.en`/`translations.ja` are
 * expected to each read as an object literal of the form
 *   { ...defaultTranslations.en, "nav.foo": "Foo", ... }
 * per the pattern documented in #203/#196, so the set of keys considered
 * "available" for a locale is the union of:
 *   (a) every key in the real `@takazudo/zudo-doc/i18n-defaults`
 *       `defaultTranslations[locale]` table, when that locale's block spreads
 *       `...defaultTranslations.<locale>`
 *   (b) every quoted-string key literal (`"nav.foo": "..."`) written directly
 *       in that locale's block
 *
 * ── A NOTE ON SELF-DEFEAT (see check-category-meta.mjs for the fuller case) ──
 * A guard that reports "OK" having parsed zero labelKeys is indistinguishable
 * from a guard that never ran. This script always prints the counts it
 * actually inspected, and treats "found no headerNav / no labelKeys / no
 * translations override" as a loud warning, never a silent pass.
 *
 * Usage: node scripts/check-nav-labels.mjs
 * Exit:  0 = OK, 1 = violations found
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// fileURLToPath, not .pathname — see check-category-meta.mjs for why.
const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/[/\\]$/, "");
const CONFIG = join(ROOT, "zfb.config.ts");

/** The `{...}`/`[...]` block starting at `source[openIndex]`, brace-balanced. */
function extractBalancedBlock(source, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
}

/** The balanced block immediately following the first `marker` in `source`. */
function findBlockAfterMarker(source, marker, openChar, closeChar) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const openIndex = source.indexOf(openChar, markerIndex);
  if (openIndex === -1) return null;
  return extractBalancedBlock(source, openIndex, openChar, closeChar);
}

/**
 * The balanced `{...}` block for a `<locale>: { ... }` entry inside a larger
 * object-literal block. Requires the key to be followed directly by `:` and
 * `{` (guarded by `\s*`) so e.g. an "en" match cannot land inside an unrelated
 * key like `"gettingStarted"` — a plain `indexOf("en:")` would.
 */
function findLocaleBlock(block, locale) {
  const re = new RegExp(`(?:^|[{,\\s])${locale}\\s*:\\s*\\{`);
  const m = re.exec(block);
  if (!m) return null;
  const openIndex = block.indexOf("{", m.index);
  return extractBalancedBlock(block, openIndex, "{", "}");
}

/** Every `labelKey: "..."` inside a block — header items and children alike. */
function parseLabelKeys(block) {
  return [...block.matchAll(/labelKey\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

/** Every quoted-string translation key literal (`"nav.foo": "..."`) in a block. */
function parseExplicitKeys(block) {
  return new Set([...block.matchAll(/["'`]([a-zA-Z0-9_.]+)["'`]\s*:\s*["'`]/g)].map((m) => m[1]));
}

function usesDefaultSpread(block, locale) {
  return new RegExp(`\\.\\.\\.\\s*defaultTranslations\\s*\\.\\s*${locale}\\b`).test(block);
}

async function availableKeysForLocale(translationsBlock, locale) {
  const keys = new Set();
  if (!translationsBlock) return keys;
  const localeBlock = findLocaleBlock(translationsBlock, locale);
  if (!localeBlock) return keys;
  for (const k of parseExplicitKeys(localeBlock)) keys.add(k);
  if (usesDefaultSpread(localeBlock, locale)) {
    const { defaultTranslations } = await import("@takazudo/zudo-doc/i18n-defaults");
    for (const k of Object.keys(defaultTranslations[locale] ?? {})) keys.add(k);
  }
  return keys;
}

const failures = [];
const warnings = [];
const notes = [];

const source = await readFile(CONFIG, "utf-8");

// ── headerNav labelKeys ─────────────────────────────────────────────────
const navBlock = findBlockAfterMarker(source, "headerNav:", "[", "]");
if (!navBlock) {
  warnings.push(
    `[NO-NAV] no headerNav block found in ${join("zfb.config.ts")} — 0 labelKey(s) checked. ` +
      `If this site does declare a headerNav, it lives somewhere this script does not look.`,
  );
}
const labelKeys = navBlock ? [...new Set(parseLabelKeys(navBlock))] : [];
if (navBlock && labelKeys.length === 0) {
  warnings.push(`[NO-LABELKEYS] headerNav block found but it declares zero labelKey(s).`);
}
notes.push(`found ${labelKeys.length} distinct labelKey(s) in headerNav`);

// ── translations.en / translations.ja available keys ───────────────────
const translationsBlock = findBlockAfterMarker(source, "translations:", "{", "}");
if (!translationsBlock) {
  warnings.push(
    `[NO-TRANSLATIONS] no translations override found in zfb.config.ts — every ` +
      `labelKey below will be checked against an EMPTY key set and fail.`,
  );
}

const enKeys = await availableKeysForLocale(translationsBlock, "en");
const jaKeys = await availableKeysForLocale(translationsBlock, "ja");
notes.push(`translations.en resolves ${enKeys.size} key(s)`);
notes.push(`translations.ja resolves ${jaKeys.size} key(s)`);

for (const key of labelKeys) {
  if (!enKeys.has(key)) {
    failures.push(
      `[MISSING-EN] labelKey "${key}" is used in headerNav but has no translations.en entry — ` +
        `renders the literal key text in the EN header.`,
    );
  }
  if (!jaKeys.has(key)) {
    failures.push(
      `[MISSING-JA] labelKey "${key}" is used in headerNav but has no translations.ja entry — ` +
        `renders the literal key text in the JA header.`,
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  · ${n}`);
for (const w of warnings) console.warn(`  ⚠️  ${w}`);

if (failures.length === 0) {
  console.log(`OK — nav label guard passed (${labelKeys.length} labelKey(s) checked).`);
  process.exit(0);
}

console.error("");
console.error(`FAILED — ${failures.length} nav label problem(s):`);
for (const f of failures) console.error(`   - ${f}`);
process.exit(1);
