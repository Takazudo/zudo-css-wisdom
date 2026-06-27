/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-content-header (epic #2344, S7).
import { t } from "@/config/i18n";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
import { createDocContentHeader } from "@takazudo/zudo-doc/doc-content-header";
import { buildFrontmatterPreviewEntries } from "./_frontmatter-preview-data";
import { DocMetainfoArea } from "./_doc-metainfo-area";
import { DocTagsArea } from "./_doc-tags-area";

export const DocContentHeader = createDocContentHeader({
  t,
  buildFrontmatterPreviewEntries,
  frontmatterRenderers,
  DocMetainfoArea,
  DocTagsArea,
});
