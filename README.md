# zudo-css-wisdom

CSS best practices documentation site for AI coding agents. Curated techniques and patterns with live CssPreview demos.

AIコーディングエージェント向けのCSSベストプラクティスドキュメントサイトです。厳選されたCSS技法とパターンをライブCssPreviewデモとともに提供します。

**Live site**: <https://zudo-css-wisdom.takazudomodular.com/>

Not official CSS documentation. Written for practical reference and AI-assisted coding.

## Topics

21 flat categories, grouped into 7 header-nav topic items (plus a separate Claude nav item that is not a content category):

- **Overview**: What is zudo-css, css-wisdom skill docs
- **Layout**: Flexbox & Grid, positioning, sizing, media, document layout
- **Typography**: Font sizing, fonts, text control
- **Styling**: Color, effects, shadows and borders
- **Responsive**: Container queries, fluid design, media queries, responsive patterns
- **Interactive**: States & transitions, selectors, scroll, accessibility
- **Methodology**: Architecture (BEM, cascade layers, CSS modules), design tokens, custom properties, design principles

## Commands

```bash
pnpm install
pnpm dev        # http://localhost:8811/
pnpm build
pnpm b4push     # pre-push validation
```

## Project Layout

```
pages/          # Host-app routing layer (zfb entry points)
src/content/    # MDX doc pages (docs/ + docs-ja/)
plugins/        # zfb integration plugins (.mjs)
zfb.config.ts   # Build config
```

## Hosting & CI/CD

- **Hosting**: Cloudflare Workers static assets
- **PR checks**: typecheck + build + Workers preview URL posted as PR comment
- **Main deploy**: build → Workers production + IFTTT notification

## Claude Code Integration

This repo includes a `css-wisdom` skill that indexes all CSS articles for AI-assisted development.

```bash
pnpm run setup:doc-skill      # Install skill globally
pnpm run generate:css-wisdom  # Regenerate topic index
```

Once installed, invoke via `/css-wisdom <topic>` in Claude Code to look up CSS best practices.
