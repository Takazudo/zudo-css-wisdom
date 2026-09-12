---
name: b4push
description: >-
  Run before-push quality checks for the zudo-css-wisdom project. Use when: (1) User says 'b4push', 'before
  push', or 'run checks', (2) Before pushing to remote, (3) After completing implementation work.
user-invocable: true
---

# Before Push Quality Checks

Run the project's quality gate before pushing.

## Command

```bash
pnpm b4push
```

## What It Checks

1. **Type checking** — `pnpm check` (astro sync + tsc --noEmit)
2. **Build** — `pnpm build` (full Astro production build)
3. **Link check** — `pnpm run check:links` (scan dist/ for broken internal links)

## When to Run

- Before pushing to remote
- After adding or moving documentation articles
- After modifying internal links between articles

## Link Check Details

The link checker (`scripts/check-links.js --strict`) scans built HTML in `dist/` for:

- Broken internal links (href pointing to non-existent pages)
- Absolute links in MDX source that bypass the base path (`/pj/zcss/`)

Runs in strict mode — exits with error on any broken link.
