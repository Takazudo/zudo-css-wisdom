// Thin stub — route-enumerators moved to the package (epic #2344, S6).
// Calls `createRouteEnumerators(ctx)` from @takazudo/zudo-doc/route-enumerators
// with the host singletons injected, then re-exports the resulting enumeration
// functions so all existing call sites continue to work unchanged.

import { createRouteEnumerators } from "@takazudo/zudo-doc/route-enumerators";
import type {
  DocsEntryForTags,
  TagInfoForEnum,
  DocPageEntry,
  DocNavNode,
} from "@takazudo/zudo-doc/route-enumerators";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, withBase, isDefaultLocaleOnlyPath } from "@/utils/base";
import { buildNavTree, collectAutoIndexNodes, type CategoryMeta } from "@/utils/docs";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import type { DocsEntry } from "@/types/docs-entry";
import { loadDocs } from "../_data";
import { resolveNavSource, resolveVersionedLocaleSource } from "./_nav-source-docs";
import { mergeLocaleDocs } from "./locale-merge";

export const {
  enumerateDocsRoutes,
  enumerateTagsRoutes,
  enumerateVersionedRoutes,
  enumerateAllRoutes,
} = createRouteEnumerators({
  defaultLocale,
  getLocaleKeys: () => Object.keys(settings.locales),
  getVersions: () => settings.versions,
  getDocTags: () => settings.docTags,
  docsUrl,
  versionedDocsUrl,
  withBase,
  loadDocs,
  isDefaultLocaleOnlyPath,
  // The factory describes collectTags / buildNavTree with the package's minimal
  // structural slots (DocsEntryForTags / DocPageEntry / Map<string, unknown> /
  // TagInfoForEnum). The host helpers are typed against the concrete project
  // types (DocsEntry / NavNode / the Locale union / TagInfo) but are runtime-
  // identical, so the stub adapts them with thin casting wrappers at the
  // injection boundary where the host owns the type knowledge.
  collectTags: (docs: DocsEntryForTags[], slugFn): Map<string, TagInfoForEnum> =>
    collectTags(docs as unknown as DocsEntry[], slugFn),
  toRouteSlug,
  buildNavTree: (docs: DocPageEntry[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs as unknown as DocsEntry[],
      locale as Locale,
      categoryMeta as Map<string, CategoryMeta>,
    ) as DocNavNode[],
  collectAutoIndexNodes,
  resolveNavSource,
  resolveVersionedLocaleSource,
  mergeLocaleDocs,
});
