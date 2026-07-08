/**
 * Schema-managed frontmatter keys that are handled by the framework and
 * should be hidden from the frontmatter preview by default.
 * These correspond to every field defined in the docsSchema in src/content.config.ts.
 */
export const DEFAULT_FRONTMATTER_IGNORE_KEYS: string[] = [
  "title",
  "description",
  "category",
  "sidebar_position",
  "sidebar_label",
  "tags",
  "search_exclude",
  "pagination_next",
  "pagination_prev",
  "draft",
  "unlisted",
  "hide_sidebar",
  "hide_toc",
  "wide",
  "doc_history",
  "standalone",
  "slug",
  "generated",
  "category_no_page",
  "category_sort_order",
];
