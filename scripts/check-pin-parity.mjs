#!/usr/bin/env node
// scripts/check-pin-parity.mjs
//
// Pin-parity gate for this consuming-site repo.
//
// Verifies that related packages stay in lockstep within package.json.
// Two version groups must be internally consistent:
//
//   zfb group (exact pins) — all four must be the same exact version:
//     dependencies["@takazudo/zfb"]
//     dependencies["@takazudo/zfb-runtime"]
//     dependencies["@takazudo/zfb-adapter-cloudflare"]
//     dependencies["@takazudo/zfb-md-wasm"]
//
//   zudo-doc group (caret/tilde stripped before comparison) — all present
//   members must resolve to the same base version:
//     dependencies["@takazudo/zudo-doc"]                  (required)
//     dependencies["@takazudo/zudo-doc-history-server"]   (required)
//     devDependencies["create-zudo-doc"]                  (OPTIONAL — see below)
//
// Historically, bumping one package (e.g. `pnpm up @takazudo/zfb@latest`)
// could silently leave related packages stale. This script makes that drift
// a CI/b4push error.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const ROOT_PKG_PATH = resolve(ROOT_DIR, "package.json");

// CANONICAL COPY: wisdom-tweaker/shared/scripts/. Distributed verbatim to every
// *-wisdom repo. Edit here, then re-sync — do not patch a single repo's copy.
//
// zfb-md-wasm belongs in this list: it is versioned in lockstep with the rest of
// the zfb family and zudo-doc peer-requires it at the same range. It was omitted
// originally, so a stale md-wasm passed the guard silently — which is exactly
// the failure this check exists to prevent, and it went unnoticed until the
// family moved off next.89.
const ZFB_PACKAGES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-adapter-cloudflare",
  "@takazudo/zfb-md-wasm",
];

// A bare semver only — no `^`/`~`/`>=`/other range operators. The zfb group's
// whole point is an EXACT pin: zfb's wrangler-version gate (check-wrangler-pin.mjs)
// assumes a single resolved version, and a range would let `pnpm install` drift the
// four packages apart even though their package.json specifiers still compare equal.
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

// `create-zudo-doc` is a GENERATION-DEPENDENT member of the zudo-doc group,
// because the fleet spans two scaffold generations:
//
//   zudo-doc 4.x / zfb 0.1.0-next.*  — create-zudo-doc is retained as a
//     devDependency after scaffold, so it must move in lockstep with zudo-doc.
//   zudo-doc 5.x / zfb 2.x           — create-zudo-doc is a one-shot
//     `pnpm create zudo-doc` CLI run and is NOT retained, so requiring it here
//     fails a correctly-configured repo. Its version parity with zudo-doc is
//     covered instead by check:template-drift, which resolves which
//     create-zudo-doc release to fetch from the zudo-doc pin.
//
// Note the optionality is keyed on the detected zudo-doc major, NOT on "is the
// package there?". A blanket optional-if-absent rule would make a 4.x repo that
// silently LOST its create-zudo-doc pin indistinguishable from a legitimate 5.x
// repo — the guard would go green on exactly the drift it exists to catch. On 4.x
// the member stays mandatory; only on 5.x+ may it be absent, and even then absence
// is reported as a named SKIP so "we didn't check this" can never read as "this
// checked out fine".
const ZUDO_DOC_PACKAGES = [
  { name: "@takazudo/zudo-doc", field: "dependencies" },
  { name: "@takazudo/zudo-doc-history-server", field: "dependencies" },
  {
    name: "create-zudo-doc",
    field: "devDependencies",
    optionalWhen: (major) => major >= 5,
    optionalReason: "not retained as a devDependency by the zudo-doc 5.x scaffold; parity covered by check:template-drift",
  },
];

function stripRange(version) {
  return version ? version.replace(/^[\^~]/, "") : version;
}

function main() {
  const rootPkg = JSON.parse(readFileSync(ROOT_PKG_PATH, "utf-8"));
  const mismatches = [];
  const skips = [];

  // ── zfb group: all exact pins must be equal ───────────────────────────────
  const zfbVersions = ZFB_PACKAGES.map((pkg) => ({
    pkg,
    version: rootPkg.dependencies?.[pkg],
  }));

  const firstZfb = zfbVersions.find((e) => e.version !== undefined);
  if (!firstZfb) {
    mismatches.push({
      group: "zfb",
      reason: `None of ${ZFB_PACKAGES.join(", ")} found in dependencies`,
    });
  } else {
    for (const { pkg, version } of zfbVersions) {
      if (version === undefined) {
        mismatches.push({
          group: "zfb",
          pkg,
          reason: `Missing from dependencies`,
          expected: firstZfb.version,
          actual: "(missing)",
        });
      } else if (!EXACT_VERSION_RE.test(version)) {
        mismatches.push({
          group: "zfb",
          pkg,
          reason: `Not an exact pin (has a range operator like ^ or ~) — the zfb group requires exact versions`,
          expected: "an exact semver, e.g. 2.2.0",
          actual: version,
        });
      } else if (version !== firstZfb.version) {
        mismatches.push({
          group: "zfb",
          pkg,
          reason: `Version mismatch within zfb group`,
          expected: firstZfb.version,
          actual: version,
        });
      }
    }
  }

  // ── zudo-doc group: stripped versions must be equal ───────────────────────
  const zudoDocVersions = ZUDO_DOC_PACKAGES.map(({ name, field, optionalWhen, optionalReason }) => ({
    pkg: name,
    field,
    optionalWhen,
    optionalReason,
    raw: rootPkg[field]?.[name],
    stripped: stripRange(rootPkg[field]?.[name]),
  }));

  // Generation is read off @takazudo/zudo-doc, the one package present in every
  // generation. NaN when it is missing/unparseable, which fails every optionalWhen
  // predicate — so an unreadable pin makes members MORE required, not less.
  const zudoDocMajor = Number.parseInt(
    stripRange(rootPkg.dependencies?.["@takazudo/zudo-doc"]) ?? "",
    10,
  );

  const firstZudoDoc = zudoDocVersions.find((e) => e.raw !== undefined);
  if (!firstZudoDoc) {
    mismatches.push({
      group: "zudo-doc",
      reason: `None of the zudo-doc packages found`,
    });
  } else {
    for (const { pkg, field, optionalWhen, optionalReason, raw, stripped } of zudoDocVersions) {
      if (raw === undefined) {
        if (optionalWhen?.(zudoDocMajor)) {
          skips.push(`${pkg} (${field}) — ${optionalReason}`);
          continue;
        }
        mismatches.push({
          group: "zudo-doc",
          pkg,
          field,
          reason: `Missing from ${field}`,
          expected: firstZudoDoc.stripped,
          actual: "(missing)",
        });
      } else if (stripped !== firstZudoDoc.stripped) {
        mismatches.push({
          group: "zudo-doc",
          pkg,
          field,
          reason: `Version mismatch within zudo-doc group (comparing stripped versions)`,
          expected: firstZudoDoc.stripped,
          actual: stripped,
          raw,
        });
      }
    }
  }

  if (mismatches.length === 0) {
    const zfbVer = firstZfb?.version ?? "(unknown)";
    const zudoDocVer = firstZudoDoc?.stripped ?? "(unknown)";
    const checkedZudoDoc = zudoDocVersions.filter((e) => e.raw !== undefined);
    console.log(`OK — pin parity verified:`);
    console.log(`  zfb group (${zfbVersions.length} packages checked) = ${zfbVer}`);
    for (const { pkg, version } of zfbVersions) {
      console.log(`    ${pkg} = ${version}`);
    }
    console.log(`  zudo-doc group (${checkedZudoDoc.length} of ${ZUDO_DOC_PACKAGES.length} packages checked) = ${zudoDocVer}`);
    for (const { pkg, field, raw } of checkedZudoDoc) {
      console.log(`    ${pkg} (${field}) = ${raw}`);
    }
    for (const s of skips) {
      console.log(`  ⏭  SKIPPED: ${s}`);
    }
    return 0;
  }

  console.error("");
  console.error("Pin parity check FAILED — package versions out of lockstep.");
  console.error("");
  for (const m of mismatches) {
    if (m.pkg) {
      console.error(`  [${m.group}] [${m.pkg}]  ${m.reason}`);
    } else {
      console.error(`  [${m.group}]  ${m.reason}`);
    }
    if (m.expected !== undefined) {
      console.error(`    expected: ${m.expected}`);
      console.error(`    actual:   ${m.actual}`);
    }
    if (m.raw !== undefined) {
      console.error(`    raw:      ${m.raw}`);
    }
    console.error("");
  }
  for (const s of skips) {
    console.error(`  ⏭  SKIPPED: ${s}`);
  }
  console.error("Fix: align the version(s) in package.json, then re-run this check.");
  return 1;
}

process.exit(main());
