# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 4b7c97f6daed21a0efc4665ff315dc66927b786d (v5.22.0; create-zudo-doc@5.22.0)
- updated: 2026-09-12
- notes: Verified create-zudo-doc@5.22.0 registry gitHead against the upstream v5.22.0 tag and packages/create-zudo-doc/package.json at that tag. All 11 tracked files were reconciled. Preserve the DocHistory and host chrome-binding route patches, root-level zfb shim coverage and compiler settings, css-wisdom generator/setup wiring, and the custom orange C favicon set. Adopt the stock check-links.js, which now includes the unquoted-attribute fix (zudolab/zudo-doc#3720), and global.css; the custom fonts were already retired in the v4 re-scaffold. The specialized skill setup also adopts the upstream symlink-conflict handling that preserves existing real files and directories. Every surviving intentional divergence is documented in .template-drift-allowlist, while non-allowlisted files must match the scaffold exactly.
