# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 82049856397927077c5288465db34e44d0939260 (v7.0.0; published create-zudo-doc@7.0.0)
- updated: 2026-10-15
- notes: Three-way reconciled published create-zudo-doc 5.28.1/current host/7.0.0 bytes without rerunning initializer. Only tsconfig, global CSS and doc route templates changed upstream. Adopted exact v7 CSS; route stubs retain generator DocHistoryBoundary binding over host chrome bindings. tsconfig now extends package base (including current config/virtual declarations), includes host declaration seam and pages, keeps relative history alias and project exclusions; stale hand-copied config types retired. Preserve specialized css-wisdom generator/setup wiring, orange C favicons, custom logo, grouped bilingual labels, preview bindings and Workers adapter. All intentional template divergences are listed in .template-drift-allowlist. Registry attestation binds v7.0.0 to the pinned source commit; check:template-drift passes against independently fetched published templates.
