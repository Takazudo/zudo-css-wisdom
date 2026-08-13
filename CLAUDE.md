# zcss — zudo-css

CSS best practices documentation site, built with zudo-doc (zfb stack, MDX, Tailwind CSS v4).

**Live site**: https://zudo-css-wisdom.takazudomodular.com/

## Commands

Package manager: **pnpm** (Node.js >= 20).

```bash
pnpm dev              # Dev server → http://localhost:8811/
pnpm build            # Production build → dist/
pnpm preview          # Preview built site
pnpm check            # Type checking (tsc + collections)
pnpm b4push           # Pre-push validation (typecheck + build + link check)
```

## Content Structure

- English (default): `src/content/docs/` -> `/docs/...`
- Japanese: `src/content/docs-ja/` -> `/ja/docs/...`
- Japanese docs should mirror the English directory structure

**Bilingual rule**: When creating or updating any doc page, ALWAYS update both the English (`docs/`) and Japanese (`docs-ja/`) versions in the same PR. Keep code blocks and `<CssPreview>` blocks identical between languages -- only translate surrounding prose. If a Japanese version does not yet exist, create it.

## Content Categories

21 flat top-level directories under `src/content/docs/` (mirrored under `src/content/docs-ja/`). The header nav (`headerNav` in `zfb.config.ts`) presents them as 8 menu items -- 5 are dropdown groups whose children are these directories, matched via each item's own `categoryMatch`.

**Overview** (direct)

- `overview/` - What is zudo-css, css-wisdom skill docs

**Layout** (group)

- `flexbox-and-grid/` - Flexbox patterns, Grid patterns, subgrid, gap vs margin
- `positioning/` - Centering, position/stacking context, containing block, anchor positioning
- `sizing/` - fit-content, clamp, logical properties, negative margin, overflow
- `media/` - aspect-ratio, object-fit/position, responsive images, letterbox staging
- `document-layout/` - Multi-column layout, table cell width, print/PDF

**Typography** (group)

- `font-sizing/` - Fluid font sizing, tiered font-size strategies, viewport-based sizing, line height
- `fonts/` - Font loading strategies, variable fonts, Japanese/Noto Sans webfonts
- `text-control/` - Overflow/clamping, vertical rhythm, text-wrap, prose heading spacing, URL wrapping

**Styling** (group)

- `color/` - OKLCH, color-mix, currentColor, dark mode, color palette/tier strategy
- `effects/` - Backdrop filter, clip-path/mask, blend modes, filters, 3D transforms, gradients
- `shadows-and-borders/` - Layered shadows, border techniques, shadow transitions

**Responsive** (direct)

- `responsive/` - Container queries, fluid design with clamp, media query best practices, responsive grids

**Interactive** (group)

- `states-and-transitions/` - Hover/focus/active states, transitions, view transitions
- `selectors/` - `:has()`, `:is()`/`:where()`, parent-state child styling
- `scroll/` - Scroll-snap, scroll-driven animations, overscroll behavior
- `accessibility/` - Form control styling, touch targets, reduced motion, color contrast

**Methodology** (group)

- `architecture/` - BEM, component-first strategy, CSS modules, cascade layers, MDX component architecture
- `design-tokens/` - Token linting, size/spacing/z-index token strategies, the tight-token-strategy deep article
- `custom-properties/` - Custom property pattern catalog, theming recipes, `@property`
- `design-principles/` - Spacing philosophy, color usage philosophy, shape language, AI design-tone spec

The header nav also has a **Claude** item (`categoryMatch: "claude"`) pointing at build-time-generated `.claude/`-derived resource docs -- it is not a `src/content/docs/` category.

Auto-generated directory (no header nav entry):

- `inbox/` - Draft/work-in-progress articles (skipped by css-wisdom skill)

## Writing Docs

All documentation files use `.mdx` format with YAML frontmatter.

### Frontmatter Fields

Schema defined in `src/content.config.ts`:

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Page title, rendered as the page h1 |
| `description` | string | No | Subtitle displayed below the title |
| `sidebar_position` | number | No | Sort order within category (lower = higher). Always set this for predictable ordering |
| `sidebar_label` | string | No | Custom text for sidebar display (overrides `title`) |
| `tags` | string[] | No | Cross-category grouping tags |
| `draft` | boolean | No | Exclude from build entirely |
| `unlisted` | boolean | No | Built but noindexed, hidden from sidebar/nav |
| `hide_sidebar` | boolean | No | Hide the left sidebar, center content |
| `hide_toc` | boolean | No | Hide the right-side table of contents |
| `standalone` | boolean | No | Hidden from sidebar nav but still indexed |
| `slug` | string | No | Custom URL slug override |
| `generated` | boolean | No | Build-time generated content (skip translation) |
| `search_exclude` | boolean | No | Exclude from search results |
| `pagination_next` | string/null | No | Override next page link (null to hide) |
| `pagination_prev` | string/null | No | Override prev page link (null to hide) |

### Content Rules

- **No h1 in content**: The frontmatter `title` is automatically rendered as the page h1. Start your content with `## h2` headings. Do not write `# h1` in the MDX body.
- **Always set `sidebar_position`**: Without it, pages sort alphabetically which is unpredictable. Use integers starting from 1.
- **Kebab-case file names**: Use `my-article.mdx`, not `myArticle.mdx` or `my_article.mdx`.

### Article Structure

Follow this pattern for all articles:

1. `## The Problem` — what goes wrong, common mistakes
2. `## The Solution` — recommended approach with CssPreview demos
3. More sections with demos as needed
4. `## When to Use` — summary of when this technique applies

### Linking Between Docs

Use relative file paths with the `.mdx` extension:

```markdown
[Link text](./sibling-page.mdx)
[Link text](../other-category/page.mdx)
[Link text](../other-category/page.mdx#anchor)
```

The remark plugin resolves these during build. External links use standard URLs.

### MDX Components

Available globally in MDX without imports:

- `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>` — Admonitions (each accepts optional `title` prop)
- `<CssPreview>` — Interactive CSS preview with code display (renders in iframe)

### CssPreview Demos

**Always include CssPreview demos** — they are the most valuable part of each article.

Key details:

- Renders inside an **iframe** — all CSS is fully isolated
- Viewport buttons: Mobile (320px), Tablet (768px), Full (~900-1100px)
- No JavaScript — interactions must be CSS-only (`:hover`, `:focus`, `:checked`, etc.)

### CSS Conventions in Demos

- Use `hsl()` colors, not hex
- Use descriptive BEM-ish class names (e.g., `.card-demo__header`)
- Use `font-family: system-ui, sans-serif` for body text
- Minimum font size: 0.75rem / 12px for labels
- **Template literal indentation**: Always indent `css={}` and `html={}` content by at least 2 spaces. The `dedent()` utility strips common leading whitespace before displaying code in the panel. Content at column 0 produces unindented code display.

## Navigation Structure

Navigation is filesystem-driven. Directory structure directly becomes sidebar navigation.

### Sidebar Ordering

- Pages are ordered by `sidebar_position` (ascending). Without it, alphabetical order is used.
- Category index pages (`index.mdx`) control category position via their own `sidebar_position`.

### Header Navigation

Defined in `zfb.config.ts` via `headerNav`. Direct items map straight to a top-level content directory via `categoryMatch`; grouped items render as a dropdown of children, each with its own `categoryMatch`:

```typescript
// Direct item
{ label: "Responsive", path: "/docs/responsive", categoryMatch: "responsive" },

// Grouped item — the parent link points at its first child's path and must
// NOT carry its own categoryMatch (see epic #196 note in zfb.config.ts)
{
  label: "Layout",
  path: "/docs/flexbox-and-grid",
  children: [
    { label: "Flexbox & Grid", path: "/docs/flexbox-and-grid", categoryMatch: "flexbox-and-grid" },
    { label: "Positioning", path: "/docs/positioning", categoryMatch: "positioning" },
  ],
},
```

Adding a new header nav item requires editing `zfb.config.ts`.

## Content Creation Workflow

### Adding a New Article

1. Create the English `.mdx` file in the appropriate category under `src/content/docs/`
2. Add frontmatter with at least `title` and `sidebar_position`
3. Write content starting with `## h2` headings (not `# h1`)
4. Include CssPreview demos to illustrate techniques
5. Create the matching Japanese file under `src/content/docs-ja/` with the same path
6. Keep code blocks and `<CssPreview>` blocks identical -- only translate prose
7. Run `pnpm build` to verify the site builds correctly

### Adding a New Category

1. Create the directory under `src/content/docs/` (kebab-case)
2. Create `index.mdx` with `title`, `description`, and `sidebar_position`
3. Add a `headerNav` entry in `zfb.config.ts` with `categoryMatch` pointing to the directory name (as a direct item, or as a child inside an existing group)
4. Mirror the directory structure under `src/content/docs-ja/`
5. Run `pnpm build` to verify

## Design Token System

Theming is **fully default** (zudo-doc's package theme, currently `@takazudo/zudo-doc@^5.2.1`) -- this repo does not configure a custom palette or color scheme; tokens ship from `@takazudo/zudo-doc/theme.css`. See the `zfb.config.ts` file-header comment for why the earlier custom color schemes + webfonts were dropped.

### Color Rules

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`)
- **ALWAYS** use the shipped semantic tokens: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, etc. (defined as `--color-*` in the package's `theme.css`)

## Doc Skill (css-wisdom)

The `css-wisdom` skill (`.claude/skills/css-wisdom/SKILL.md`) is **generated** by `pnpm generate:css-wisdom` (runs `scripts/generate-css-wisdom.js`). It is gitignored -- do NOT track it in git or edit it directly. To update the skill content, edit the generator script and re-run `pnpm generate:css-wisdom`. Add descriptions for new articles to `.claude/skills/css-wisdom/descriptions.json`.

## Claude Code Skills

This repo manages zcss-specific Claude Code skills in `.claude/skills/`:

- **`css-wisdom`** — Generated topic index of all CSS articles. Symlinked to `~/.claude/skills/css-wisdom` so it's available globally. Supports `-u`/`--update` mode.
- **`l-writing`** — Writing and formatting rules for MDX articles. **Before writing or editing docs, invoke `/l-writing`.**
- **`l-handle-deep-article`** — Guide for converting flat articles into deep articles with sub-pages. Local to this repo.
- **`l-demo-component`** — Guide for CssPreview component usage and `defaultOpen` prop conventions. Local to this repo.
- **`l-translate`** — Translate English docs to Japanese using the `ja-translator` subagent. Invoke `/l-translate <path-or-category>`.
- **`b4push`** — Before-push quality checks (type check, build, link check). Invoke `/b4push`.

### Agents

- **`ja-translator`** — Subagent for translating MDX docs from English to Japanese.

### Translation Workflow

After editing or creating an English doc, translate the Japanese counterpart using `/l-translate`. After editing a Japanese doc, update the English counterpart similarly.

## Site Config

- Base path: `/` (root, no sub-path prefix)
- Hosting: **Cloudflare Workers static assets** (config in `wrangler.toml`)
- Build/site config: `zfb.config.ts` (`siteUrl` host MUST match the `wrangler.toml` custom-domain route)

## CI/CD

Workflows live in `.github/workflows/`:

- **`pr-checks.yml`** — typecheck + build + a Cloudflare Workers preview URL posted as a PR comment
- **`main-deploy.yml`** — build + deploy to Cloudflare Workers static assets production, an automated cutover step (enables the workers.dev subdomain + attaches the `zudo-css-wisdom.takazudomodular.com` custom domain via the CF API), then an IFTTT notification
- Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (needs **Workers: Edit**, plus **Zone: Edit** on `takazudomodular.com` for the custom-domain attach), `IFTTT_PROD_NOTIFY`
- See `CUTOVER.md` for the production cutover runbook and manual fallbacks

## Safety Rules

- `rm -rf`: relative paths only (`./path`), never absolute
- No force push, no `--amend` unless explicitly permitted
- WIP / prototype / scratch files go to the repo-scoped cclogs dir (`$DROPBOX_CCLOGS_DIR/zudo-css-wisdom/`), not `__inbox/`. `__inbox/` (gitignored) is retained only for a prototype that must import this repo's production code or use its Vite/workspace tooling, so relative imports resolve.
