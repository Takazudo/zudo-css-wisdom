#!/usr/bin/env node
// scripts/check-wrangler-pin.mjs
//
// Drift guard: keep the installed `wrangler` in lockstep with the wrangler
// version @takazudo/zfb expects.
//
// WHY THIS EXISTS (hidden cross-package contract — not recoverable from this
// repo's code alone):
//   zfb's `dev` / `preview` commands run a hard gate. zfb shells out to
//   `pnpm exec wrangler --version` and refuses to start the local server
//   unless that version EXACTLY equals a wrangler version pinned *inside the
//   zfb binary* (its EXPECTED_WRANGLER_VERSION — see upstream
//   crates/zfb-toolchain-pins). zfb bumps that expectation across releases
//   (next.35 expected 4.72.0, next.36 expects 4.85.0), so a
//   `pnpm up @takazudo/zfb` that forgets to re-pin `wrangler` in package.json
//   silently breaks local `pnpm dev` / `pnpm preview`. Nothing else catches it:
//   `pnpm build` has no wrangler gate, and CI never runs `zfb dev`/`preview`.
//
// This guard extracts zfb's expected wrangler version from the installed
// platform binary and asserts the installed wrangler matches it — the same
// comparison zfb's gate makes, run cheaply without starting a server.
//
// Needs node_modules (resolves the zfb platform binary + the installed
// wrangler) — run after `pnpm install`. Degrades gracefully: if it cannot
// locate the binary or extract the expected version, it WARNS and PASSES
// rather than blocking on an unknowable expectation.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

// os-cpu key -> zfb platform package (mirrors @takazudo/zfb/bin/zfb.mjs).
const ZFB_PLATFORM_PACKAGES = {
  "darwin-arm64": "@takazudo/zfb-darwin-arm64",
  "darwin-x64": "@takazudo/zfb-darwin-x64",
  "linux-arm64": "@takazudo/zfb-linux-arm64-gnu",
  "linux-x64": "@takazudo/zfb-linux-x64-gnu",
  "win32-x64": "@takazudo/zfb-win32-x64-msvc",
};

function stripRange(version) {
  return version ? version.replace(/^[\^~]/, "") : version;
}

function warnSkip(message) {
  console.warn(`⚠ wrangler pin check skipped — ${message}`);
  console.warn("  (cannot determine zfb's expected wrangler version; not blocking)");
  return 0;
}

function fail(lines) {
  console.error("");
  console.error("wrangler pin check FAILED.");
  console.error("");
  for (const l of lines) console.error(l);
  console.error("");
  return 1;
}

// Locate the active zfb platform binary the same way zfb.mjs does.
// The platform binary is an OPTIONAL dependency of @takazudo/zfb, so under
// pnpm it lives in zfb's own dependency context (.pnpm), not the top-level
// node_modules. Resolve it through a require anchored at the zfb package —
// the same anchoring zfb.mjs gets from `createRequire(import.meta.url)`.
function resolveZfbBinary() {
  const key = `${process.platform}-${process.arch}`;
  const pkg = ZFB_PLATFORM_PACKAGES[key];
  if (!pkg) return { skip: `unsupported platform ${key}` };
  let binPath;
  try {
    const zfbPkgJsonPath = require.resolve("@takazudo/zfb/package.json", { paths: [ROOT_DIR] });
    const zfbRequire = createRequire(zfbPkgJsonPath);
    const pkgJsonPath = zfbRequire.resolve(`${pkg}/package.json`);
    const pkgDir = pkgJsonPath.replace(/[\\/]package\.json$/, "");
    const binName = process.platform === "win32" ? "zfb.exe" : "zfb";
    binPath = join(pkgDir, binName);
  } catch {
    return { skip: `zfb platform binary ${pkg} not installed` };
  }
  if (!existsSync(binPath)) return { skip: `zfb platform binary ${pkg} not installed` };
  return { binPath };
}

// zfb embeds EXPECTED_WRANGLER_VERSION as a literal in its binary. In the
// compiled rodata the version sits adjacent to the gate's error strings:
//   ...installed in this project<VERSION>invalid adapter in zfb.config.json
// Anchor on that to extract it. Best-effort: returns null if the layout shifts.
function extractExpectedWrangler(binPath) {
  const blob = readFileSync(binPath).toString("latin1");
  const anchored =
    blob.match(/installed in this project(\d+\.\d+\.\d+)invalid adapter/) ??
    blob.match(/(\d+\.\d+\.\d+)invalid adapter in zfb\.config\.json/);
  return anchored ? anchored[1] : null;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function main() {
  const rootPkg = readJson(resolve(ROOT_DIR, "package.json")) ?? {};
  const declaredPin = rootPkg.devDependencies?.wrangler ?? rootPkg.dependencies?.wrangler;

  const zfbVersion = readJson(
    require.resolve("@takazudo/zfb/package.json", { paths: [ROOT_DIR] }),
  )?.version;

  // Resolve zfb's expectation first. If we can't, skip (don't block).
  const { binPath, skip } = resolveZfbBinary();
  if (skip) return warnSkip(skip);

  const expected = extractExpectedWrangler(binPath);
  if (!expected) {
    return warnSkip("zfb's wrangler-gate error-string layout changed (extraction miss)");
  }

  // The gate compares the INSTALLED wrangler (`pnpm exec wrangler --version`),
  // so that is the authoritative thing to verify.
  const installedWrangler = readJson(
    resolve(ROOT_DIR, "node_modules/wrangler/package.json"),
  )?.version;

  if (!installedWrangler) {
    return fail([
      `zfb ${zfbVersion ?? "(unknown)"} requires wrangler \`${expected}\` for \`zfb dev\`/\`preview\`,`,
      "but no `wrangler` is installed in this project.",
      "",
      `Fix: add it as an exact devDependency and reinstall:`,
      `  pnpm add -D --save-exact wrangler@${expected}`,
    ]);
  }

  if (installedWrangler !== expected) {
    return fail([
      `zfb ${zfbVersion ?? "(unknown)"} expects wrangler \`${expected}\`,`,
      `but the installed wrangler is \`${installedWrangler}\` (package.json pin: \`${declaredPin ?? "(none)"}\`).`,
      "",
      "zfb's `dev`/`preview` gate is an exact-match check, so local dev is currently broken.",
      `Fix: pin the wrangler devDependency to \`${expected}\` (exact) and reinstall:`,
      `  pnpm add -D --save-exact wrangler@${expected}`,
    ]);
  }

  console.log(
    `OK — wrangler pin in lockstep: installed \`${installedWrangler}\` matches the version zfb ${zfbVersion ?? "(unknown)"} expects.`,
  );
  return 0;
}

process.exit(main());
