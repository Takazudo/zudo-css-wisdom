/**
 * Concrete entry type for docs collections.
 *
 * Mirrors the public surface that pages consume from `getCollection(...)`.
 * Originally this was structurally identical to Astro's `CollectionEntry`
 * but is defined locally now that the project runs on the zfb content
 * engine — collection-name-specific generics are not exposed by zfb, so
 * pages cast collection entries to this shape via `pages/_data.ts`.
 */
// Structural shape of zfb's optional rendered-content payload for a doc
// entry (kept loose to stay engine-agnostic — pages do not rely on the
// exact field set today).
type RenderedContent = unknown;
export interface DocsEntry {
  id: string;
  body?: string;
  collection: string;
  data: {
    title: string;
    description?: string;
    category?: string;
    sidebar_position?: number;
    sidebar_label?: string;
    tags?: string[];
    search_exclude?: boolean;
    pagination_next?: string | null;
    pagination_prev?: string | null;
    draft?: boolean;
    unlisted?: boolean;
    hide_sidebar?: boolean;
    hide_toc?: boolean;
    doc_history?: boolean;
    standalone?: boolean;
    slug?: string;
    generated?: boolean;
  };
  rendered?: RenderedContent;
  filePath?: string;
}
