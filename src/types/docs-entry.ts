import type { DocsData } from "@/config/docs-schema";

/**
 * Concrete entry type for docs collections.
 *
 * Mirrors the public surface that pages consume from `getCollection(...)`.
 * Originally this was structurally identical to Astro's `CollectionEntry`
 * but is defined locally now that the project runs on the zfb content
 * engine — collection-name-specific generics are not exposed by zfb, so
 * pages cast collection entries to this shape via `pages/_data.ts`.
 *
 * `data` is typed as `DocsData` — the `z.infer`-derived type from
 * `src/config/docs-schema.ts` — so the field set is maintained in one place.
 */
// Structural shape of zfb's optional rendered-content payload for a doc
// entry (kept loose to stay engine-agnostic — pages do not rely on the
// exact field set today).
type RenderedContent = unknown;
export interface DocsEntry {
  id: string;
  /** zfb content engine slug (filename without `.md`/`.mdx`; used by toRouteSlug). */
  slug: string;
  body?: string;
  collection: string;
  data: DocsData;
  rendered?: RenderedContent;
  filePath?: string;
}
