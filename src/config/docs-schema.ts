import { z } from "zod";
import { settings } from "./settings";
import { tagVocabulary } from "./tag-vocabulary";

// ---------------------------------------------------------------------------
// Tags schema builder — governance-aware.
// ---------------------------------------------------------------------------

/**
 * Build the `tags` schema based on governance mode. `"strict"` tightens to a
 * `z.enum` of every canonical id plus every alias (content still uses
 * aliases verbatim — resolution happens at the aggregation layer, after
 * parsing).
 */
function buildTagsSchema() {
  const vocabularyActive =
    settings.tagVocabulary && settings.tagGovernance === "strict";
  if (!vocabularyActive) return z.array(z.string()).optional();
  const allowed = new Set<string>();
  for (const entry of tagVocabulary) {
    allowed.add(entry.id);
    for (const alias of entry.aliases ?? []) allowed.add(alias);
  }
  const allowedList = [...allowed];
  if (allowedList.length === 0) return z.array(z.string()).optional();
  const [first, ...rest] = allowedList;
  return z
    .array(z.enum([first, ...rest] as [string, ...string[]]))
    .optional();
}

// ---------------------------------------------------------------------------
// Schema builder — single source of truth for the docs frontmatter shape.
// ---------------------------------------------------------------------------

/**
 * Build the docs frontmatter zod schema.
 *
 * Returns a single `z.object(...).passthrough()` that is reused for every
 * docs collection (default + per-locale + per-version + per-version-per-locale).
 * The `tags` field is governance-aware: `buildTagsSchema()` returns a plain
 * `z.array(z.string())` when governance is off, or a restricted `z.enum`
 * when `tagGovernance: "strict"` + `tagVocabulary` is configured.
 *
 * `.passthrough()` keeps custom frontmatter keys (e.g. `author`, `status`)
 * available downstream — the frontmatter-preview UI relies on this to
 * surface arbitrary keys without declaring each one here.
 */
export function buildDocsSchema() {
  return z
    .object({
      title: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      sidebar_position: z.number().optional(),
      sidebar_label: z.string().optional(),
      tags: buildTagsSchema(),
      search_exclude: z.boolean().optional(),
      pagination_next: z.string().nullable().optional(),
      pagination_prev: z.string().nullable().optional(),
      draft: z.boolean().optional(),
      unlisted: z.boolean().optional(),
      hide_sidebar: z.boolean().optional(),
      hide_toc: z.boolean().optional(),
      wide: z.boolean().optional(),
      doc_history: z.boolean().optional(),
      standalone: z.boolean().optional(),
      slug: z.string().optional(),
      generated: z.boolean().optional(),
      // Category metadata expressed as a directory index.mdx's frontmatter — the
      // frontmatter form of `_category_.json`. `category_no_page` makes the index
      // a non-linked sidebar header excluded from routes/sitemap/search;
      // `category_sort_order` sets the child sort direction. Frontmatter wins
      // over the sidecar.
      category_no_page: z.boolean().optional(),
      category_sort_order: z.enum(["asc", "desc"]).optional(),
    })
    .passthrough();
}

// ---------------------------------------------------------------------------
// Inferred type — single source of truth for the docs data shape.
// ---------------------------------------------------------------------------

/**
 * TypeScript type inferred from the docs frontmatter zod schema.
 *
 * Import this type instead of hand-writing the field list in `pages/_data.ts`
 * (`ZfbDocsData`) or `src/types/docs-entry.ts` (`DocsEntry.data`).
 *
 * The `[key: string]: unknown` index signature from `.passthrough()` is
 * naturally present via `z.infer` — custom frontmatter keys remain accessible
 * downstream (e.g. frontmatter-preview) without extra casting.
 */
export type DocsData = z.infer<ReturnType<typeof buildDocsSchema>>;
