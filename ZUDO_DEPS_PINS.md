# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 50cbd5c6c9e5a795d72a74a855e105e4939d4eab (v5.27.0; create-zudo-doc@5.27.0)
- updated: 2026-09-25
- notes: Verified create-zudo-doc@5.22.0 registry gitHead against the upstream v5.22.0 tag and packages/create-zudo-doc/package.json at that tag. All 11 tracked files were reconciled. Preserve the DocHistory and host chrome-binding route patches, root-level zfb shim coverage and compiler settings, css-wisdom generator/setup wiring, and the custom orange C favicon set. Adopt the stock check-links.js, which now includes the unquoted-attribute fix (zudolab/zudo-doc#3720), and global.css; the custom fonts were already retired in the v4 re-scaffold. The specialized skill setup also adopts the upstream symlink-conflict handling that preserves existing real files and directories. Every surviving intentional divergence is documented in .template-drift-allowlist, while non-allowlisted files must match the scaffold exactly.
  2026-09-25 sync to 5.27.0: verified the create-zudo-doc@5.27.0 registry gitHead against the upstream v5.27.0 tag. Diffing the 5.22.0 and 5.27.0 published templates trees showed scripts/check-links.js as the only changed file; it was re-adopted verbatim (heading IDs now come from the package's extractAllHeadingIds, and the MDX id scan ignores escaped `\<` fake tags, zudolab/zudo-doc#4218). check-links.test.mjs still passes against it. The other 10 tracked files are unchanged upstream, so every host customization above stands as-is.
