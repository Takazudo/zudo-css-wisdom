/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-tags-area (epic #2344, S7).
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { createDocTagsArea } from "@takazudo/zudo-doc/doc-tags-area";

// Inlined from the original _doc-tags-area.tsx `tagHref` helper.
// Builds the base-prefixed tag detail page href for the given locale.
// The tag segment is URL-encoded at the href site only.
function tagHref(tag: string, locale: string): string {
  const encoded = encodeURIComponent(tag);
  const path =
    locale === defaultLocale
      ? `/docs/tags/${encoded}`
      : `/${locale}/docs/tags/${encoded}`;
  return withBase(path);
}

export type { DocTagsAreaProps } from "@takazudo/zudo-doc/doc-tags-area";

export const DocTagsArea = createDocTagsArea({
  settings,
  defaultLocale,
  tagVocabularyEntries: tagVocabulary,
  tagHref,
  t,
});
