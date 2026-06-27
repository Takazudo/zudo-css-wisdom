/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/footer-with-defaults (epic #2344, S5).
// Wires host singletons into the package factory and passes the tag loading
// function as a dependency so the factory never imports @/ aliases.
import { settings } from "@/config/settings";
import { isExternal, resolveHref, withBase } from "@/utils/base";
import { defaultLocale } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { mergeLocaleDocs } from "./locale-merge";
import { stableDocs, memoizeDerived } from "./_nav-source-cache";
import type { DocsEntry } from "@/types/docs-entry";
import { createFooterWithDefaults } from "@takazudo/zudo-doc/footer-with-defaults";

// ---------------------------------------------------------------------------
// Tag loading (host-side, reads collections via stableDocs / memoizeDerived)
// ---------------------------------------------------------------------------

function loadTagsForLocale(lang: string) {
  if (lang === defaultLocale) {
    const baseDocs = stableDocs("docs");
    return memoizeDerived([baseDocs], "footerTaglist;default", () => {
      const docs: DocsEntry[] = baseDocs.filter(
        (d) => !d.data.draft && !d.data.unlisted && !d.data.category_no_page,
      );
      const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
      return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
    });
  }
  const baseDocs = stableDocs("docs");
  const localeDocs = stableDocs(`docs-${lang}`);
  return memoizeDerived([baseDocs, localeDocs], `footerTaglist;${lang}`, () => {
    const result = mergeLocaleDocs({
      baseDocs: baseDocs.filter((d) => !d.data.draft),
      localeDocs: localeDocs.filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    const docs: DocsEntry[] = result.docs.filter((d) => !d.data.category_no_page);
    const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
    return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag, lang));
  });
}

// ---------------------------------------------------------------------------
// Thin-stub export
// ---------------------------------------------------------------------------

export const FooterWithDefaults = createFooterWithDefaults({
  settings,
  defaultLocale,
  tagVocabulary,
  isExternal,
  resolveHref,
  withBase,
  loadTagsForLocale,
});
