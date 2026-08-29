# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 7ca73f197021961603c22042748c23d9ce9d6c50 (v5.13.1)
- updated: 2026-08-29
- notes: Preserve the DocHistory and host chrome-binding route patches, root-level zfb shim coverage in tsconfig, css-wisdom generator/setup wiring, host global.css divergence, the custom orange C favicon set, and check-links.js support for unquoted attributes in minified zfb HTML (zudolab/zudo-doc#3720); every intentional divergence is documented in .template-drift-allowlist, while non-allowlisted files must match the scaffold exactly.
