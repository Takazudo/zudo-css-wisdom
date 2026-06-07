#!/usr/bin/env node
// scripts/check-pin-parity.mjs
//
// Pin-parity gate for this consuming-site repo.
//
// Verifies that related packages stay in lockstep within package.json.
// Two version groups must be internally consistent:
//
//   zfb group (exact pins) — all three must be the same version:
//     dependencies["@takazudo/zfb"]
//     dependencies["@takazudo/zfb-runtime"]
//     dependencies["@takazudo/zfb-adapter-cloudflare"]
//
//   zudo-doc group (caret/tilde stripped before comparison) — all three
//   must resolve to the same base version:
//     dependencies["@takazudo/zudo-doc"]
//     dependencies["@takazudo/zudo-doc-history-server"]
//     devDependencies["create-zudo-doc"]
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

const ZFB_PACKAGES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-adapter-cloudflare",
];

const ZUDO_DOC_PACKAGES = [
  { name: "@takazudo/zudo-doc", field: "dependencies" },
  { name: "@takazudo/zudo-doc-history-server", field: "dependencies" },
  { name: "create-zudo-doc", field: "devDependencies" },
];

function stripRange(version) {
  return version ? version.replace(/^[\^~]/, "") : version;
}

function main() {
  const rootPkg = JSON.parse(readFileSync(ROOT_PKG_PATH, "utf-8"));
  const mismatches = [];

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
  const zudoDocVersions = ZUDO_DOC_PACKAGES.map(({ name, field }) => ({
    pkg: name,
    field,
    raw: rootPkg[field]?.[name],
    stripped: stripRange(rootPkg[field]?.[name]),
  }));

  const firstZudoDoc = zudoDocVersions.find((e) => e.raw !== undefined);
  if (!firstZudoDoc) {
    mismatches.push({
      group: "zudo-doc",
      reason: `None of the zudo-doc packages found`,
    });
  } else {
    for (const { pkg, field, raw, stripped } of zudoDocVersions) {
      if (raw === undefined) {
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
    console.log(`OK — pin parity verified:`);
    console.log(`  zfb group (${ZFB_PACKAGES.length} packages) = ${zfbVer}`);
    for (const { pkg, version } of zfbVersions) {
      console.log(`    ${pkg} = ${version}`);
    }
    console.log(`  zudo-doc group (${ZUDO_DOC_PACKAGES.length} packages) = ${zudoDocVer}`);
    for (const { pkg, field, raw } of zudoDocVersions) {
      console.log(`    ${pkg} (${field}) = ${raw}`);
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
  console.error("Fix: align the version(s) in package.json, then re-run this check.");
  return 1;
}

process.exit(main());
