# S7 Content Codemod Report

Generated: 2026-06-07

## Precheck Manifest

### File Counts

| Category | Count |
|---|---|
| Total .mdx files (docs + docs-ja) | 199 |
| Generated (`generated: true`) — skipped | 11 |
| Real files processed | 188 |
| Real files changed | 166 |

**Generated files (excluded from all transforms):**
- `src/content/docs/claude/index.mdx`
- `src/content/docs/claude-agents/ja-translator.mdx`
- `src/content/docs/claude-md/root.mdx`
- `src/content/docs/claude-skills/b4push.mdx`
- `src/content/docs/claude-skills/l-demo-component.mdx`
- `src/content/docs/claude-skills/l-handle-deep-article.mdx`
- `src/content/docs/claude-skills/l-translate.mdx`
- `src/content/docs/claude-skills/l-writing.mdx`
- `src/content/docs/claude-skills/zudo-doc-design-system.mdx`
- `src/content/docs/claude-skills/zudo-doc-translate.mdx`
- `src/content/docs/claude-skills/zudo-doc-version-bump.mdx`

### Custom MDX Tags Found (non-generated files)

| Tag | Occurrences |
|---|---|
| `<CssPreview>` | 488 |
| `<TailwindPreview>` | 60 |
| `<CategoryNav>` | 14 |
| `<Info>` | 8 |
| `<Card>` | 4 |
| `<Teleport>` | 2 |
| `<Content>` | 2 |
| `<Note>` | 2 |
| `<Tip>` | 2 |
| `<Button>` | 2 |
| `<PageLayout>` | 2 |
| `<Avatar>` | 2 |
| `<Badge>` | 2 |
| `<Dialog>` | 2 |

### Admonitions Needing Blank-Line Repair

Files with admonitions missing required blank lines (real files only):

- `src/content/docs/methodology/design-systems/z-index-strategy.mdx` (4 admonitions: `:::tip`, 2x `:::note`, `:::info`)
- `src/content/docs-ja/methodology/design-systems/z-index-strategy.mdx` (4 admonitions: same, translated)
- `src/content/docs/claude-skills/l-writing.mdx` — **excluded** (has `generated: true`; admonitions are inside code blocks)

## Transform Results

| Transform | Count |
|---|---|
| Import lines stripped (`import CssPreview/TailwindPreview from '@/components/...'`) | 196 |
| `client:load` directives stripped | 544 |
| Internal links normalized to `.mdx` form | 20 |
| Admonition blank lines inserted | 16 |

### Link Normalization Details

20 links normalized across 6 files (EN+JA symmetric):

- `src/content/docs/methodology/design-systems/tight-token-strategy/index.mdx` — 6 links
- `src/content/docs-ja/methodology/design-systems/tight-token-strategy/index.mdx` — 6 links
- `src/content/docs/methodology/design-systems/custom-properties-advanced/index.mdx` — 3 links
- `src/content/docs-ja/methodology/design-systems/custom-properties-advanced/index.mdx` — 3 links
- `src/content/docs/styling/effects/gradient-techniques/index.mdx` — 1 link
- `src/content/docs-ja/styling/effects/gradient-techniques/index.mdx` — 1 link

**86 links were unresolvable** (target files do not exist at those paths — pre-existing broken links, left unchanged per spec).

**3 absolute path links** (`/ja/docs/...`) left unchanged — route-form links not in scope.

## Acceptance Checks

- [x] No `import CssPreview`/`import TailwindPreview` remain in real (non-generated) content
- [x] No `client:load` attribute directives remain in real content (2 text-prose mentions in `mdx-component-architecture.mdx` left unchanged — they describe Astro concepts, not JSX attributes)
- [x] Internal links normalized where target file exists; unresolvable left unchanged
- [x] Admonitions have blank lines before/after `:::` directives
- [x] `generated: true` files untouched (0 diff lines in claude* dirs)
- [x] EN/JA portable parity preserved (transforms symmetric across locales)
- [x] No `.mdx.mdx` double-extension introduced

## Build Result

`pnpm exec zfb build` — see commit message for result.
