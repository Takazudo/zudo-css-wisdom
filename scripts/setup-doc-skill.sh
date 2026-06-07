#!/usr/bin/env bash
set -euo pipefail

# ── setup-doc-skill.sh ─────────────────────────────────
# Creates a Claude Code skill that exposes your zudo-doc
# documentation as a knowledge base, then symlinks it into
# the user-scope skills directory (~/.claude/skills/).
# ────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Read project name from package.json
PROJECT_NAME=$(node -e "console.log(require('$ROOT_DIR/package.json').name || 'my-project')")
DEFAULT_SKILL_NAME="${PROJECT_NAME}-wisdom"

# Prompt for skill name
echo ""
echo "=== zudo-doc Skill Setup ==="
echo ""
read -rp "Skill name [$DEFAULT_SKILL_NAME]: " SKILL_NAME
SKILL_NAME="${SKILL_NAME:-$DEFAULT_SKILL_NAME}"

# Validate skill name (allow only alphanumeric, hyphens, underscores)
if [[ ! "$SKILL_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Error: Skill name may only contain letters, numbers, hyphens, and underscores."
  exit 1
fi

# Resolve the main repo root (handles git worktrees correctly)
# Use the main worktree path so symlinks survive worktree removal
REPO_ROOT="$(git -C "$ROOT_DIR" worktree list | head -1 | awk '{print $1}')"

SKILL_DIR="$ROOT_DIR/.claude/skills/$SKILL_NAME"
DOCS_DIR="$ROOT_DIR/src/content/docs"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Validate docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: Documentation directory not found at $DOCS_DIR"
  exit 1
fi

# Helper: replace a symlink or file at the given path
ensure_symlink() {
  local link_path="$1"
  local target="$2"
  if [ -L "$link_path" ] || [ -e "$link_path" ]; then
    rm -rf "$link_path"
  fi
  ln -s "$target" "$link_path"
}

# Create skill directory
mkdir -p "$SKILL_DIR"

# Create symlink to docs directory inside the skill
ensure_symlink "$SKILL_DIR/docs" "$REPO_ROOT/src/content/docs"
echo "  Created docs symlink -> $REPO_ROOT/src/content/docs"

# Check if Japanese docs exist and create symlink
DOCS_JA_DIR="$ROOT_DIR/src/content/docs-ja"
HAS_JA=""
if [ -d "$DOCS_JA_DIR" ]; then
  HAS_JA="true"
  ensure_symlink "$SKILL_DIR/docs-ja" "$REPO_ROOT/src/content/docs-ja"
  echo "  Created docs-ja symlink -> $REPO_ROOT/src/content/docs-ja"
fi

# Discover top-level doc categories dynamically
DOC_TREE=""
for dir in "$DOCS_DIR"/*/; do
  [ -d "$dir" ] || continue
  dirname="$(basename "$dir")"
  DOC_TREE="${DOC_TREE}- ${dirname}/
"
done

# Generate SKILL.md
cat > "$SKILL_DIR/SKILL.md" << SKILLEOF
---
name: $SKILL_NAME
description: >-
  Search and reference documentation from the $PROJECT_NAME project.
  Use when answering questions about $PROJECT_NAME features, configuration,
  components, or usage patterns.
user-invocable: true
argument-hint: "[-u|--update] [topic keyword, e.g., 'configuration', 'sidebar', 'i18n']"
---

# $PROJECT_NAME Documentation Reference

Look up documentation from the $PROJECT_NAME project.
Documentation base path: \`src/content/docs\` (relative to repo root)

## Mode Detection

Parse the argument string for flags:

- If args start with \`-u\` or \`--update\`: enter **Update mode** (see below)
- Otherwise: enter **Lookup mode** (default)

Strip the flag from the remaining argument to get the topic keyword.

## Lookup Mode (default)

1. Find the relevant article(s) from the \`docs/\` directory based on the topic
2. Read ONLY the specific article(s) you need — do NOT load all articles at once
3. Apply the information from the article when answering the user's question
4. Mention the source article path so the user can find it for further reading

## Update Mode (\`-u\` / \`--update\`)

The user has new information and wants to add or update documentation in this repo.

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
     \`<Danger>\`, \`<HtmlPreview>\`) where appropriate.
   - For live demos, use \`<HtmlPreview>\` with \`js\`/\`displayJs\` props.
   - Link to other docs using relative paths with \`.mdx\` extension.
5. **Update Japanese docs**: Create or update the corresponding file under
   \`docs-ja/\` mirroring the English directory structure. Keep code blocks,
   Mermaid diagrams, and \`<HtmlPreview>\` blocks identical — only translate
   surrounding prose. Exception: pages with \`generated: true\` skip translation.
6. **Format**: Run \`pnpm format:md\` to format the new/changed MDX files.
7. **Verify**: Run \`pnpm build\` to confirm the site builds correctly.

## Documentation Structure

The documentation is organized in MDX files under \`docs/\`:

\`\`\`
${DOC_TREE}\`\`\`

Browse the \`docs/\` directory to discover available articles. Each \`.mdx\` file
has YAML frontmatter with \`title\` and \`description\` fields that help identify
the right article to read.
SKILLEOF

if [ "$HAS_JA" = "true" ]; then
  cat >> "$SKILL_DIR/SKILL.md" << JAEOF

## Japanese Documentation

Japanese translations are available under \`docs-ja/\`. When the user is working
in Japanese or asks for Japanese content, prefer articles from \`docs-ja/\`.
JAEOF
fi

echo "  Generated SKILL.md"

# Symlink into global skills directory
mkdir -p "$GLOBAL_SKILLS_DIR"
ensure_symlink "$GLOBAL_SKILLS_DIR/$SKILL_NAME" "$SKILL_DIR"

echo ""
echo "Done! Skill '$SKILL_NAME' is ready."
echo ""
echo "  Project skill: $SKILL_DIR"
echo "  Global symlink: $GLOBAL_SKILLS_DIR/$SKILL_NAME"
echo ""
echo "You can now use it in Claude Code with: /$SKILL_NAME <topic>"
echo ""
