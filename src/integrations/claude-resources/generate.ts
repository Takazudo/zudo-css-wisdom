import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { escapeForMdx } from "./escape-for-mdx";

export interface ClaudeResourcesConfig {
  claudeDir: string;
  projectRoot?: string;
  docsDir: string;
}

interface ClaudeMdItem {
  displayPath: string;
  slug: string;
  relPath: string;
}

interface CommandItem {
  name: string;
  description: string;
}

interface SkillReference {
  name: string;
  title: string;
  content: string;
}

interface SkillItem {
  name: string;
  dir: string;
  description: string;
  references: SkillReference[];
}

interface AgentItem {
  name: string;
  file: string;
  description: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function parseFrontmatter(content: string) {
  try {
    return matter(content);
  } catch {
    return null;
  }
}

function escapeTitle(s: string): string {
  return s.replace(/"/g, '\\"');
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

function writeCategoryMeta(
  outputDir: string,
  label: string,
  position: number,
  description: string,
  noPage = true,
) {
  const meta: Record<string, unknown> = { label, position, description };
  if (noPage) meta.noPage = true;
  fs.writeFileSync(
    path.join(outputDir, "_category_.json"),
    JSON.stringify(meta, null, 2) + "\n",
  );
}

// ---------------------------------------------------------------------------
// CLAUDE.md discovery
// ---------------------------------------------------------------------------

function findClaudeMdFiles(dir: string, excludeDirs: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const item of fs.readdirSync(dir)) {
    if (item === "node_modules") continue;
    if (item.startsWith(".")) continue;
    const itemPath = path.join(dir, item);
    if (excludeDirs.some((d) => itemPath.startsWith(d))) continue;

    // lstat (not stat) so symlinks aren't followed — a symlinked dir can point
    // back into the project (e.g. e2e fixtures linking to packages/) or out to
    // a slow mount (e.g. /mnt/c on WSL) and either turns the walk into a
    // multi-minute hang.
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(itemPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findClaudeMdFiles(itemPath, excludeDirs));
    } else if (stat.isFile() && item === "CLAUDE.md") {
      results.push(itemPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// CLAUDE.md generation
// ---------------------------------------------------------------------------

function generateClaudemdDocs(
  config: ClaudeResourcesConfig,
): ClaudeMdItem[] {
  const projectRoot = config.projectRoot ?? path.dirname(config.claudeDir);
  const outputDir = path.join(config.docsDir, "claude-md");

  cleanDir(outputDir);

  const excludeDirs = [
    path.join(projectRoot, ".git"),
    path.join(projectRoot, "node_modules"),
    path.join(projectRoot, "worktrees"),
    path.join(projectRoot, "dist"),
    path.join(projectRoot, "out"),
    path.join(projectRoot, "public"),
    path.join(projectRoot, "__inbox"),
    path.join(projectRoot, "test-results"),
    path.join(projectRoot, "e2e", "fixtures"),
    path.join(config.docsDir),
  ];

  const files = findClaudeMdFiles(projectRoot, excludeDirs);
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: ClaudeMdItem[] = [];

  for (const filePath of files) {
    const relPath = path.relative(projectRoot, filePath);
    const displayPath = `/${relPath}`;
    const dirPart = path.dirname(relPath);
    const slug = dirPart === "." ? "root" : dirPart.replace(/\//g, "--");
    items.push({ displayPath, slug, relPath });
  }

  // Sort BEFORE writing: sidebar_position is baked into each generated .mdx,
  // so the root-first/alphabetical order must be applied first — sorting after
  // the write loop would leave positions in filesystem-walk order.
  items.sort((a, b) => {
    if (a.slug === "root") return -1;
    if (b.slug === "root") return 1;
    return a.displayPath.localeCompare(b.displayPath);
  });

  const emittedSlugs = new Map<string, string>();
  items.forEach((item, index) => {
    const previous = emittedSlugs.get(item.slug);
    if (previous !== undefined) {
      throw new Error(
        `claude-resources: slug collision — "${item.slug}" is produced by both "${previous}" and "${item.relPath}". Rename one of the directories to resolve the conflict.`,
      );
    }
    emittedSlugs.set(item.slug, item.relPath);
    const content = fs.readFileSync(path.join(projectRoot, item.relPath), "utf8");
    const mdx = `---
title: "${escapeTitle(item.displayPath)}"
description: "CLAUDE.md at ${escapeTitle(item.displayPath)}"
sidebar_position: ${index + 1}
sidebar_label: "${escapeTitle(item.relPath)}"
generated: true
---

**Path:** \`${item.relPath}\`

${escapeForMdx(content.trim())}
`;
    fs.writeFileSync(path.join(outputDir, `${item.slug}.mdx`), mdx);
  });

  writeCategoryMeta(outputDir, "CLAUDE.md", 900, "Project-specific instructions");
  return items;
}

// ---------------------------------------------------------------------------
// Commands generation
// ---------------------------------------------------------------------------

function generateCommandsDocs(config: ClaudeResourcesConfig): CommandItem[] {
  const commandsDir = path.join(config.claudeDir, "commands");
  const outputDir = path.join(config.docsDir, "claude-commands");

  cleanDir(outputDir);

  if (!fs.existsSync(commandsDir)) return [];

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: CommandItem[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = file.replace(/\.md$/, "");
    const description = (parsed.data.description as string) || "";

    items.push({ name, description });

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(description)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${escapeForMdx(parsed.content.trim())}
`;
    fs.writeFileSync(path.join(outputDir, `${name}.mdx`), mdx);
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryMeta(outputDir, "Commands", 901, "Custom slash commands");
  return items;
}

// ---------------------------------------------------------------------------
// Skills generation
// ---------------------------------------------------------------------------

type TreeEntry =
  | { isDir: false; name: string }
  | { isDir: true; name: string; children: string[] };

function getSkillFileTree(
  skillDir: string,
  subDirs: { name: string; files: string[] }[],
): string {
  const lines: string[] = [`${skillDir}/`];
  const entries: TreeEntry[] = [{ isDir: false, name: "SKILL.md" }];

  for (const sub of subDirs) {
    entries.push({ isDir: true, name: sub.name, children: sub.files });
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const prefix = isLast ? "└── " : "├── ";

    if (!entry.isDir) {
      lines.push(`${prefix}${entry.name}`);
    } else {
      lines.push(`${prefix}${entry.name}/`);
      for (let j = 0; j < entry.children.length; j++) {
        const child = entry.children[j];
        const childIsLast = j === entry.children.length - 1;
        const continuation = isLast ? "    " : "│   ";
        const childPrefix = childIsLast ? "└── " : "├── ";
        lines.push(`${continuation}${childPrefix}${child}`);
      }
    }
  }

  return lines.join("\n");
}

function getScriptDescription(filePath: string): string {
  try {
    const topLines = fs.readFileSync(filePath, "utf8").split("\n", 2);
    // Skip shebang, use second line if available
    const commentLine = topLines[0].startsWith("#!")
      ? topLines[1] || ""
      : topLines[0];
    // Match # comments (shell/python) or // comments (JS/TS)
    const match = commentLine.match(/^(?:#|\/\/)\s*(.+)/);
    return match ? ` — ${match[1]}` : "";
  } catch {
    return "";
  }
}

function getSkillReferences(
  skillsDir: string,
  skillDir: string,
): SkillReference[] {
  const refsDir = path.join(skillsDir, skillDir, "references");
  if (!fs.existsSync(refsDir)) return [];

  return fs
    .readdirSync(refsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(refsDir, f), "utf8");
      const name = f.replace(/\.md$/, "");
      const h1Match = content.match(/^#\s+(.+)$/m);
      const title = h1Match ? h1Match[1] : name;
      return { name, title, content };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function generateSkillsDocs(config: ClaudeResourcesConfig): SkillItem[] {
  const skillsDir = path.join(config.claudeDir, "skills");
  const outputDir = path.join(config.docsDir, "claude-skills");

  cleanDir(outputDir);

  if (!fs.existsSync(skillsDir)) return [];

  const dirs = fs.readdirSync(skillsDir).filter((d) => {
    const skillPath = path.join(skillsDir, d);
    return (
      fs.statSync(skillPath).isDirectory() &&
      fs.existsSync(path.join(skillPath, "SKILL.md"))
    );
  });

  if (dirs.length === 0) return [];

  ensureDir(outputDir);
  const items: SkillItem[] = [];

  for (const dir of dirs) {
    const content = fs.readFileSync(
      path.join(skillsDir, dir, "SKILL.md"),
      "utf8",
    );
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = (parsed.data.name as string) || dir;
    const description = (parsed.data.description as string) || "";
    const references = getSkillReferences(skillsDir, dir);

    items.push({ name, dir, description, references });

    const scriptFiles = listFiles(path.join(skillsDir, dir, "scripts"));
    const assetFiles = listFiles(path.join(skillsDir, dir, "assets"));
    const refFiles = references.map((r) => `${r.name}.md`);

    // Collect non-empty subdirectories for tree display
    const subDirs: { name: string; files: string[] }[] = [];
    if (scriptFiles.length > 0) subDirs.push({ name: "scripts", files: scriptFiles });
    if (refFiles.length > 0) subDirs.push({ name: "references", files: refFiles });
    if (assetFiles.length > 0) subDirs.push({ name: "assets", files: assetFiles });

    // File tree + links to renderable .md sub-files
    let fileStructureSection = "";
    if (subDirs.length > 0) {
      const tree = `\`\`\`\n${getSkillFileTree(dir, subDirs)}\n\`\`\``;

      // Collect links to all .md sub-files that get pages
      // Links use ./<subpage> which resolves correctly from the skill page URL
      // (the page URL already includes the dir, e.g. /docs/claude-skills/<dir>/)
      const links: string[] = [];
      for (const ref of references) {
        links.push(`- [references/${ref.name}.md](./ref-${ref.name})`);
      }
      for (const f of scriptFiles.filter((s) => s.endsWith(".md"))) {
        const slug = f.replace(/\.md$/, "");
        links.push(`- [scripts/${f}](./script-${slug})`);
      }
      for (const f of assetFiles.filter((a) => a.endsWith(".md"))) {
        const slug = f.replace(/\.md$/, "");
        links.push(`- [assets/${f}](./asset-${slug})`);
      }

      const linkList = links.length > 0 ? `\n\n${links.join("\n")}` : "";
      fileStructureSection = `## File Structure\n\n${tree}${linkList}`;
    }

    const shortDesc = description.length > 200
      ? description.substring(0, 200) + "..."
      : description;

    // Rewrite references/scripts/assets links in skill body to match doc site URLs
    let skillBody = parsed.content.trim();
    skillBody = skillBody
      .replace(/\]\(references\/([^)]+)\.md\)/g, "](./ref-$1)")
      .replace(/\]\(scripts\/([^)]+)\.md\)/g, "](./script-$1)")
      .replace(/\]\(assets\/([^)]+)\.md\)/g, "](./asset-$1)");

    const body = [
      fileStructureSection,
      escapeForMdx(skillBody),
    ]
      .filter(Boolean)
      .join("\n\n");

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(shortDesc)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${body}`;

    // Write skill page as flat file
    fs.writeFileSync(path.join(outputDir, `${dir}.mdx`), mdx);

    // Generate unlisted sub-pages (flat files with custom slug for nested breadcrumbs)
    // File: <dir>--ref-<name>.mdx, slug: claude-skills/<dir>/ref-<name>
    const skillSlugBase = `claude-skills/${dir}`;

    for (const ref of references) {
      const subSlug = `${skillSlugBase}/ref-${ref.name}`;
      const refMdx = `---
title: "${escapeTitle(ref.title)}"
slug: "${subSlug}"
unlisted: true
generated: true
---

${escapeForMdx(ref.content.trim())}
`;
      fs.writeFileSync(path.join(outputDir, `${dir}--ref-${ref.name}.mdx`), refMdx);
    }

    for (const f of scriptFiles.filter((s) => s.endsWith(".md"))) {
      const slug = f.replace(/\.md$/, "");
      const subSlug = `${skillSlugBase}/script-${slug}`;
      const raw = fs.readFileSync(
        path.join(skillsDir, dir, "scripts", f),
        "utf8",
      );
      const h1Match = raw.match(/^#\s+(.+)$/m);
      const title = h1Match ? h1Match[1] : slug;
      fs.writeFileSync(
        path.join(outputDir, `${dir}--script-${slug}.mdx`),
        `---\ntitle: "${escapeTitle(title)}"\nslug: "${subSlug}"\nunlisted: true\ngenerated: true\n---\n\n${escapeForMdx(raw.trim())}\n`,
      );
    }

    for (const f of assetFiles.filter((a) => a.endsWith(".md"))) {
      const slug = f.replace(/\.md$/, "");
      const subSlug = `${skillSlugBase}/asset-${slug}`;
      const raw = fs.readFileSync(
        path.join(skillsDir, dir, "assets", f),
        "utf8",
      );
      const h1Match = raw.match(/^#\s+(.+)$/m);
      const title = h1Match ? h1Match[1] : slug;
      fs.writeFileSync(
        path.join(outputDir, `${dir}--asset-${slug}.mdx`),
        `---\ntitle: "${escapeTitle(title)}"\nslug: "${subSlug}"\nunlisted: true\ngenerated: true\n---\n\n${escapeForMdx(raw.trim())}\n`,
      );
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryMeta(outputDir, "Skills", 902, "Skill packages");
  return items;
}

// ---------------------------------------------------------------------------
// Agents generation
// ---------------------------------------------------------------------------

function generateAgentsDocs(config: ClaudeResourcesConfig): AgentItem[] {
  const agentsDir = path.join(config.claudeDir, "agents");
  const outputDir = path.join(config.docsDir, "claude-agents");

  cleanDir(outputDir);

  if (!fs.existsSync(agentsDir)) return [];

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: AgentItem[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = (parsed.data.name as string) || file.replace(/\.md$/, "");
    const description = (parsed.data.description as string) || "";
    const model = (parsed.data.model as string) || "";
    const fileSlug = file.replace(/\.md$/, "");

    items.push({ name, file: fileSlug, description, model });

    const modelBadge = model ? `**Model:** \`${model}\`\n` : "";

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(description)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${modelBadge}
${escapeForMdx(parsed.content.trim())}
`;
    fs.writeFileSync(path.join(outputDir, `${fileSlug}.mdx`), mdx);
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryMeta(outputDir, "Agents", 903, "Custom subagents");
  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generateOverviewIndex(
  config: ClaudeResourcesConfig,
  {
    hasCommands,
    hasSkills,
    hasAgents,
    hasClaudemd,
  }: { hasCommands: boolean; hasSkills: boolean; hasAgents: boolean; hasClaudemd: boolean },
) {
  const outputDir = path.join(config.docsDir, "claude");
  cleanDir(outputDir);
  ensureDir(outputDir);

  // Build the explicit slug list from whichever sub-categories were generated.
  // CategoryNav with `categories` renders cards for each slug by resolving
  // the node in the nav tree (including noPage auto-index categories) and
  // falling back to docsUrl(slug, locale) for the href when noPage=true.
  const categorySlugs: string[] = [];
  if (hasClaudemd) categorySlugs.push("claude-md");
  if (hasSkills) categorySlugs.push("claude-skills");
  if (hasAgents) categorySlugs.push("claude-agents");
  if (hasCommands) categorySlugs.push("claude-commands");

  const categoriesAttr = JSON.stringify(categorySlugs);

  const index = `---
title: "Claude"
description: "Claude Code configuration reference."
sidebar_position: 899
generated: true
---

Claude Code configuration reference.

## Resources

<CategoryNav categories={${categoriesAttr}} />
`;
  fs.writeFileSync(path.join(outputDir, "index.mdx"), index);
}

export function generateClaudeResourcesDocs(config: ClaudeResourcesConfig) {
  const claudemds = generateClaudemdDocs(config);
  const commands = generateCommandsDocs(config);
  const skills = generateSkillsDocs(config);
  const agents = generateAgentsDocs(config);

  generateOverviewIndex(config, {
    hasClaudemd: claudemds.length > 0,
    hasCommands: commands.length > 0,
    hasSkills: skills.length > 0,
    hasAgents: agents.length > 0,
  });

  return {
    claudemd: claudemds.length,
    commands: commands.length,
    skills: skills.length,
    agents: agents.length,
  };
}
