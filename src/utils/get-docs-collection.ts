import { getCollection } from "@takazudo/zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import type { DocsData } from "@/config/docs-schema";
import { toRouteSlug } from "@/utils/slug";

/**
 * Load docs from a named collection via the zfb content engine.
 *
 * Returns a Promise<DocsEntry[]> for backward compatibility with .astro
 * components that call `await getDocsCollection(...)`. Internally zfb's
 * `getCollection` is synchronous (ADR-004 sync contract) so the Promise
 * resolves immediately.
 *
 * Each entry gets an `id` field (Astro-compat: stripped index suffix, same
 * as `toRouteSlug(slug)`) and a `collection` field so downstream
 * `@/utils/docs` helpers that read those fields work unchanged.
 */
export async function getDocsCollection(name: string): Promise<DocsEntry[]> {
  const entries = getCollection<DocsData>(name);
  return entries.map((e) => ({
    ...e,
    // Astro-compat: strip trailing `/index` so `getting-started/index.mdx`
    // → id "getting-started" (matching Astro 5's glob() loader behaviour).
    id: toRouteSlug(e.slug),
    collection: name,
  })) as unknown as DocsEntry[];
}
