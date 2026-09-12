---
name: l-handle-deep-article
description: >-
  Create or convert CSS best-practices articles into "deep articles" with sub-pages in the zcss
  zudo-doc site (zfb stack). Use when: (1) An article topic has enough depth to warrant "see more" reference
  sub-pages, (2) Converting a flat .mdx article into a category with index + child pages, (3) Adding
  deep reference content to an existing article, (4) User says 'deep article', 'add sub-pages',
  'expand article', or 'add reference pages'.
user-invocable: true
argument-hint: "[article path or topic name]"
---

# Deep Article Handler

Convert a flat `.mdx` article into a folder with `index.mdx` + sub-pages when the topic has enough depth.

Invoke `/l-writing` for the authoritative MDX, demo, and bilingual rules before applying this structure.

## When to Use

Use when a topic has:

- Reference tables or catalogs too large for inline
- Multiple distinct sub-patterns each deserving focused demos
- Cheat sheet material users would browse independently
- 10+ real-world recipes (card patterns, form patterns, animation recipes)

Do **not** use for topics that fit in a single page with 4-5 demos.

## Conversion Steps

### 1. Create folder, move main article

```bash
cd src/content/docs/<category>/
mkdir my-topic
mv my-topic.mdx my-topic/index.mdx
```

### 2. Update `index.mdx` frontmatter

Add a "Deep Dive" section at bottom:

```mdx
## Deep Dive

- [Sub-page Title](./sub-page-1.mdx) - Brief description
- [Sub-page Title](./sub-page-2.mdx) - Brief description
```

### 3. Create sub-pages

Each sub-page follows `/l-writing` and focuses on one aspect:

```mdx
---
title: Sub-page Title
sidebar_position: 1
---

## Recipes

(CssPreview demos and content)
```

## Conventions

- Main article keeps Problem/Solution/Demo structure
- Sub-pages can be reference-oriented (tables, catalogs, recipes)
- Follow `/l-writing` for content and CSS/demo conventions
- File naming: kebab-case
- After conversion, regenerate css-wisdom index: `pnpm run generate:css-wisdom`
