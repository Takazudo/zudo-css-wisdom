# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 70c574747e498c47f35fa9051ab36b0a69ac808d (v10.0.0; published create-zudo-doc@10.0.0)
- updated: 2026-11-10
- notes: Three-way reconciled published create-zudo-doc 7.0.0/current host/10.0.0 bytes without rerunning initializer. Base templates other than scripts/setup-doc-skill.sh are unchanged from 7.0.0; global.css, check-links.js, and pages/index.tsx still match the published 10.0.0 bytes. Route stubs stay allowlisted (DocHistoryBoundary over host chrome bindings). tsconfig stays allowlisted (package base, host declaration seam, relative history alias, project exclusions). setup-doc-skill.sh stays the specialized css-wisdom wirer; the 9.1.4 porcelain worktree-list fix (#4705) is applied to its REPO_ROOT lookup, and the template's generated-skill placement/locale rewrites are not — this script does not emit that skill text. Preserve orange C favicons, custom logo, grouped bilingual labels, preview bindings, Workers adapter, and omitted themePack (Graphite). All intentional template divergences are listed in .template-drift-allowlist. Tag v10.0.0 is the create-zudo-doc 10.0.0 release commit; check:template-drift fetches the published tarball.
