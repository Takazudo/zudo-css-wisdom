---
name: l-writing
description: >-
  Authoritative writing, MDX formatting, bilingual, and CSS demo rules for zcss articles.
  Consult before creating or editing docs in src/content/docs/ or src/content/docs-ja/,
  or when asked about writing rules or article format.
user-invocable: true
argument-hint: "[question about writing or formatting rules]"
---

# Writing & MDX Rules for zcss Articles

Use `/l-writing` before writing or editing documentation in either language. This is the single local authoring skill for shared zudo-doc rules and this site's CSS article conventions.

## Provenance

Reconciled with **zudo-doc 5.22.0** (tag `v5.22.0`), upstream `.claude/skills/zudo-doc-writing-rules/SKILL.md`; [published upstream rules](https://zudo-doc.takazudomodular.com/docs/claude-skills/zudo-doc-writing-rules/).

The upstream rules are folded into this skill so they remain available without another repository or skill installation. Configuration paths, related skills, and validation commands below refer to this repository. When reconciling a newer upstream version, retain the CSS-specific article and demo rules.

## Audience and Style

Primary readers are AI agents learning CSS patterns; human developers also read and maintain the docs. Assume basic CSS knowledge. Explain the specific behavior, trade-offs, and common mistakes directly, using active voice and short sentences. Avoid filler, hedging, and subjective judgments such as "elegant" or "best."

Keep each article focused on one CSS technique or pattern. Show code before its detailed explanation, and use tables for comparisons and quick references. For a topic that needs sub-pages, use `/l-handle-deep-article`.

## Article Structure

Use this section order for CSS technique articles:

1. `## The Problem` — what goes wrong and why it matters.
2. `## The Solution` — the recommended approach, illustrated with `CssPreview` demos.
3. Additional sections as needed: focused examples, a quick-reference table, common AI mistakes, or `TailwindPreview` equivalents when useful. Prefer demos inline beside their explanations.
4. `## When to Use` — decision guidance and trade-offs.

Reference links may follow. Deep-article sub-pages may use a reference-oriented structure for tables, catalogs, or recipes.

## MDX Rules

### Titles and Headings

The frontmatter `title` supplies the page h1. Start body headings at `##`; a body-level `#` repeats the title and breaks the heading hierarchy. Do not skip heading levels, and give each heading content before starting the next section.

```mdx
---
title: Flexbox Centering
sidebar_position: 1
---

## The Problem

The content needs to stay centered as the container changes size.
```

### Files and Ordering

Use kebab-case filenames such as `centering-techniques.mdx`. Set `sidebar_position` on every page, including each category's `index.mdx`; otherwise pages sort alphabetically. The index controls its category's position in the parent sidebar, so choose its number accordingly. Small integers with gaps allow later insertions.

### Markdown Formatting

Use headings and whitespace to separate sections. Do not add body-level horizontal rules merely for visual separation; reserve them for cases where the rule itself has meaning, such as a syntax demonstration. Keep code blocks outside list items and use bold for inline emphasis, not as a replacement for headings.

### Bilingual Content and Generated Pages

Create or update the EN and JA versions together, using the same path beneath `src/content/docs/` and `src/content/docs-ja/`. Translate prose and frontmatter text values; keep code blocks identical. For `<CssPreview>` and `<TailwindPreview>`, keep the payload body (`html={}`, `css={}`, `height={}`, including indentation) byte-identical -- they must render the same demo -- but translate the `title` prop like any other prose.

These exceptions are part of the rule:

- Files with `generated: true` are generator-owned. Change their source or generator, then regenerate; do not edit or translate the generated files by hand.
- Claude/Codex resource generators own their overview and category `index.mdx` targets in the default and configured locale directories. They generate localized indexes from `resource.*` translation keys. Do not create locale stubs. If an authored file occupies a generator target, move or remove that file and express custom titles, descriptions, and labels through `translations` in `zudoDoc()`.
- Generated resource detail files stay in the default content directory; other locale routes use body fallback. Do not copy those files into locale directories.
- A route covered by `defaultLocaleOnlyPrefixes` is intentionally default-locale-only and needs no JA mirror. Read the current value in the `zudoDoc()` options in `zfb.config.ts`; do not assume the upstream repository's setting applies here.

## Frontmatter Schema

The schema belongs to `@takazudo/zudo-doc/docs-schema`. Its default `buildDocsSchema` is wired in by `zudoDoc()`; this host has no `src/content.config.ts`. The following fields reflect upstream 5.22.0:

| Field | Type | Required? | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | Renders as the page h1 |
| `sidebar_position` | number | Authoring rule | Schema-optional, but set it on every page for predictable ordering |
| `description` | string | No | Subtitle below the h1 |
| `sidebar_label` | string | No | Overrides the sidebar label |
| `category_shape` | `"note-tray"` | No | Declares a flat, top-level note-tray category on its index |
| `note_tray_dated` | boolean | No | Requires `date` on all tray items, including unlisted items |
| `note_tray_sidebar` | `"index" \| "year" \| "month"` | No | Grouped styles require a dated tray |
| `category_sort_order` | `"asc" \| "desc"` | No | Category/tray display direction; defaults to `"asc"` |
| `date` | `"YYYY-MM-DD"` | For dated tray items | Quotes are optional; zfb retains date scalars as strings |
| `updated` | `"YYYY-MM-DD"` | No | Optional update date; quotes are optional |
| `tags` | string[] | No | Cross-category grouping |
| `draft` | boolean | No | Excludes the page from the build |
| `unlisted` | boolean | No | Builds the page but hides it from sidebar/navigation |
| `generated` | boolean | No | Marks generator-owned content |
| `hide_sidebar` | boolean | No | Hides the left sidebar |
| `hide_toc` | boolean | No | Hides the right-side table of contents |

Zod validates known fields, but the schema uses `.passthrough()`: custom keys survive without acquiring built-in behavior. A typo such as `sidebar_postion` therefore passes validation and silently loses ordering. Check field spelling; a successful build does not catch unknown keys.

## Linking Between Docs

Use relative file paths with the `.mdx` extension so the framework can resolve and validate the target during the build:

```markdown
[Sibling page](./sibling-page.mdx)
[Another category](../other-category/page.mdx#anchor)
```

Do not use absolute `/docs/...` URLs or extensionless paths for authored cross-references. Keep equivalent relative links in both languages; external references use standard URLs. Check built links with `pnpm check:links`.

## MDX Components

`CssPreview` and `TailwindPreview` are registered through `src/chrome-bindings.ts`. Use them directly in MDX without imports or Astro `client:load` directives. The package also supplies admonitions globally.

Use admonitions sparingly. Directive syntax suits prose:

```mdx
:::note[Optional Title]
Supplementary information.
:::
```

Use JSX when nesting JSX content:

```mdx
<Note title="Optional Title">Supplementary information.</Note>
```

Admonition types include `note`, `tip`, `info`, `warning`, `danger`, and `caution`, with matching capitalized JSX components and optional `title` props. JSX also provides `<Important>` for GitHub-style important alerts.

## CssPreview Demos

Include a `<CssPreview>` for each CSS concept. Keep each demo focused, give it a descriptive `title`, and prefer showing behavior over adding prose.

- Previews run inside an isolated iframe. Interactions must use CSS states such as `:hover`, `:focus`, `:checked`, or `:target`; no JavaScript or `<script>` tags.
- Viewport buttons are **Mobile (320px)**, **Tablet (768px)**, and **Full** (100% of the available width, typically about 900–1100px).
- For code-panel `defaultOpen` choices, sizing, and responsive demo breakpoints, use `/l-demo-component`.

### CSS Conventions

- Use `hsl()` colors, not hex.
- Use descriptive BEM-ish demo class names, such as `.card-demo__header`.
- Use `font-family: system-ui, sans-serif` for body text.
- Keep labels at a minimum font size of **0.75rem / 12px**.
- Consult `/css-wisdom <topic>` before writing non-trivial demo CSS.

### Template Literal Indentation

Indent the template-literal content in both `css={}` and `html={}` by **at least 2 spaces**, including top-level selectors and HTML elements. The preview's `dedent()` utility removes common leading whitespace for the code panel. Content at column 0 produces an unindented code display; preserve relative nesting as well as the common indent.

```mdx
<CssPreview
  title="Card Header"
  html={`
    <div class="card-demo__header">Card header</div>
  `}
  css={`
    .card-demo__header {
      padding: 16px;
      font-family: system-ui, sans-serif;
      font-size: 0.875rem;
      background: hsl(210, 50%, 95%);
      color: hsl(210, 80%, 40%);
    }
  `}
/>
```

## Authoring Workflow

1. Choose the category using `CLAUDE.md`'s content and navigation guidance.
2. Write or update the article following the rules above; use `/l-handle-deep-article` when sub-pages are needed.
3. Update the matching language version through `/l-translate`, respecting the generated/default-locale-only exceptions above.
4. Run `pnpm format:md` and `pnpm check`, then `pnpm build`. Review any formatter changes and run `pnpm format:md:check` to confirm formatting. The build validates required frontmatter and MDX; use `pnpm check:links` for built-site links.
5. After adding, moving, or removing articles, run `pnpm generate:css-wisdom` to refresh the generated topic index.
