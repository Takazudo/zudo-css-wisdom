#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";

const ROOT = process.cwd();

// Resolve the main repo root (handles git worktrees correctly)
function getRepoRoot() {
  return execSync("git rev-parse --show-toplevel", {
    encoding: "utf-8",
  }).trim();
}

const REPO_ROOT = getRepoRoot();
const DOCS_DIR = join(ROOT, "src/content/docs");
const DESCRIPTIONS_PATH = join(
  ROOT,
  ".claude/skills/css-wisdom/descriptions.json"
);
const OUTPUT_PATH = join(ROOT, ".claude/skills/css-wisdom/SKILL.md");

const SKIP_CATEGORIES = new Set([
  "overview",
  "inbox",
  "claude-agents",
  "claude-md",
  "claude-skills",
]);

// Header-nav groups, in nav display order, per epic #196's target-taxonomy
// table. `direct: true` marks a group that is its own flat header-nav item
// (not a dropdown with children) -- rendered without a category sub-heading.
// Overview and Claude are also direct nav items but carry no skill-relevant
// categories (overview is in SKIP_CATEGORIES; Claude has no docs category).
const HEADER_NAV_GROUPS = [
  {
    label: "Layout",
    categories: [
      "flexbox-and-grid",
      "positioning",
      "sizing",
      "media",
      "document-layout",
    ],
  },
  {
    label: "Typography",
    categories: ["font-sizing", "fonts", "text-control"],
  },
  {
    label: "Styling",
    categories: ["color", "effects", "shadows-and-borders"],
  },
  {
    label: "Responsive",
    direct: true,
    categories: ["responsive"],
  },
  {
    label: "Interactive",
    categories: ["states-and-transitions", "selectors", "scroll", "accessibility"],
  },
  {
    label: "Methodology",
    categories: [
      "architecture",
      "design-tokens",
      "custom-properties",
      "design-principles",
    ],
  },
];

const CATEGORY_LABELS = {
  "flexbox-and-grid": "Flexbox & Grid",
  positioning: "Positioning",
  sizing: "Sizing",
  media: "Media",
  "document-layout": "Document Layout",
  "font-sizing": "Font Sizing",
  fonts: "Fonts",
  "text-control": "Text Control",
  color: "Color",
  effects: "Effects",
  "shadows-and-borders": "Shadows & Borders",
  responsive: "Responsive",
  "states-and-transitions": "States & Transitions",
  selectors: "Selectors",
  scroll: "Scroll",
  accessibility: "Accessibility",
  architecture: "Architecture",
  "design-tokens": "Design Tokens",
  "custom-properties": "Custom Properties",
  "design-principles": "Design Principles",
};

// Flattened category order, derived from HEADER_NAV_GROUPS, used for
// grouping/sorting and to detect any category left out of the nav shape.
const CATEGORY_ORDER = HEADER_NAV_GROUPS.flatMap((group) => group.categories);

async function collectMdxFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectMdxFiles(fullPath)));
    } else if (entry.name.endsWith(".mdx")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const descriptions = JSON.parse(await readFile(DESCRIPTIONS_PATH, "utf-8"));
  const allFiles = await collectMdxFiles(DOCS_DIR);

  // Build list of relevant articles
  const articles = [];
  for (const fullPath of allFiles) {
    const relPath = relative(DOCS_DIR, fullPath);
    const parts = relPath.split("/");
    const category = parts[0];

    // Skip overview/, inbox/, and auto-generated claude-* scaffold dirs
    if (SKIP_CATEGORIES.has(category)) continue;

    // Skip top-level category index files (e.g. layout/index.mdx)
    // but keep deep article index files (e.g. design-tokens/tight-token-strategy/index.mdx).
    // Exception: a category index that carries its own description entry is a real
    // article doubling as the landing page, so it stays indexed. Today that is only
    // custom-properties/index.mdx -- the promoted custom-properties-advanced deep
    // article (epic #196 decision 6), which kept its full body when it became a
    // category. Keying off descriptions.json rather than a hardcoded path means the
    // curated description is the signal: no entry, no index.
    if (
      parts.length === 2 &&
      basename(relPath) === "index.mdx" &&
      !(relPath in descriptions)
    )
      continue;

    // Look up description
    if (!(relPath in descriptions)) {
      process.stderr.write(`Warning: No description for ${relPath}, skipping\n`);
      continue;
    }

    articles.push({ relPath, category, description: descriptions[relPath] });
  }

  // Group by category
  const grouped = {};
  for (const article of articles) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  // Sort articles within each category by relPath
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.relPath.localeCompare(b.relPath));
  }

  // Build SKILL.md
  const lines = [];
  lines.push(`---
name: css-wisdom
description: >-
  Reference CSS best practices documentation when working on CSS, styling, or front-end layout
  tasks. Use when: (1) Writing or reviewing CSS code, (2) Choosing between CSS approaches (e.g.,
  flexbox vs grid, gap vs margin), (3) Implementing visual effects, responsive layouts, or modern
  CSS features, (4) User asks about CSS best practices or patterns.
user-invocable: true
argument-hint: "[-u|--update] [topic keyword, e.g., 'flexbox', 'dark mode', 'centering']"
---

# CSS Best Practices Reference

Look up CSS best practices from the documentation articles.
Base path: \`${join(REPO_ROOT, "src/content/docs")}\`

## Mode Detection

Parse the argument string for flags:

- If args start with \`-u\` or \`--update\`: enter **Update mode** (see below)
- Otherwise: enter **Lookup mode** (default)

Strip the flag from the remaining argument to get the topic keyword.

## Lookup Mode (default)

1. Find the relevant article(s) from the topic index below based on the CSS task at hand
2. Read ONLY the specific article(s) you need — do NOT load all articles at once
3. Apply the patterns and recommendations from the article when writing CSS
4. Mention the source article path so the user can find it for further reading

## Update Mode (\`-u\` / \`--update\`)

The user has new information about CSS and wants to add or update
documentation in this repo.

### Workflow

1. **Understand the new info**: Ask the user what they learned or want to
   document. The topic keyword (if provided) hints at the subject area.
2. **Find existing docs**: Search the \`docs/\` directory for articles related to
   the topic. Read them to understand what is already covered.
3. **Decide create vs update**: If an existing article covers the topic, update
   it. Otherwise, create a new \`.mdx\` file in the appropriate subdirectory.
4. **Write the content**: Follow the doc-authoring rules in the root CLAUDE.md:
   - Required frontmatter: \`title\` (string). Always set \`sidebar_position\`.
     Optional: \`description\`, \`sidebar_label\`, \`tags\`, etc.
   - Do NOT use \`# h1\` in content — the frontmatter \`title\` renders as h1.
     Start with \`## h2\` headings.
   - Use available MDX components (\`<Note>\`, \`<Tip>\`, \`<Info>\`, \`<Warning>\`,
     \`<Danger>\`, \`<CssPreview>\`) where appropriate.
   - For live demos, use \`<CssPreview>\` with \`css\`/\`html\` props.
   - Link to other docs using relative paths with \`.mdx\` extension.
5. **Update Japanese docs**: Create or update the corresponding file under
   \`docs-ja/\` mirroring the English directory structure. Keep code blocks
   and \`<CssPreview>\` blocks identical — only translate surrounding prose.
6. **Update skill index**: Run \`pnpm generate:css-wisdom\` to regenerate the
   topic index. Add descriptions for new articles to
   \`.claude/skills/css-wisdom/descriptions.json\`.
7. **Verify**: Run \`pnpm build\` to confirm the site builds correctly.

## Topic Index

Each entry: \`file path\` — brief description.`);

  for (const group of HEADER_NAV_GROUPS) {
    const categoriesWithArticles = group.categories.filter((cat) => grouped[cat]);
    if (categoriesWithArticles.length === 0) continue;

    lines.push("");
    lines.push(`## ${group.label}`);

    if (group.direct) {
      // Direct nav item (not a dropdown group) -- list articles straight
      // under the group heading, no redundant category sub-heading.
      for (const cat of categoriesWithArticles) {
        lines.push("");
        for (const article of grouped[cat]) {
          lines.push(`- \`${article.relPath}\` — ${article.description}`);
        }
      }
      continue;
    }

    for (const cat of categoriesWithArticles) {
      const label = CATEGORY_LABELS[cat] || cat;
      lines.push("");
      lines.push(`### ${label}`);
      lines.push("");
      for (const article of grouped[cat]) {
        lines.push(`- \`${article.relPath}\` — ${article.description}`);
      }
    }
  }

  // Warn about categories not in CATEGORY_ORDER
  for (const cat of Object.keys(grouped)) {
    if (!CATEGORY_ORDER.includes(cat)) {
      process.stderr.write(`Warning: Category "${cat}" not in CATEGORY_ORDER, ${grouped[cat].length} article(s) excluded\n`);
    }
  }

  lines.push("");

  await writeFile(OUTPUT_PATH, lines.join("\n"), "utf-8");
  console.log(`Generated ${relative(ROOT, OUTPUT_PATH)}`);
  console.log(`  ${articles.length} articles indexed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
