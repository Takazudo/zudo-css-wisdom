/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-page-renderer (epic #2344, S7).
import { t } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, absoluteUrl } from "@/utils/base";
import { getNavSectionForSlug } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import { createMdxComponents } from "../_mdx-components";
import { createRenderDocPage } from "@takazudo/zudo-doc/doc-page-renderer";
import { buildInlineVersionSwitcher } from "./_inline-version-switcher";
import { DocPageShell } from "./_doc-page-shell";
import { DocContentHeader } from "./_doc-content-header";
import { DocMetainfoArea } from "./_doc-metainfo-area";
import { DocHistoryArea } from "./_doc-history-area";

export type { RenderDocPageOptions } from "@takazudo/zudo-doc/doc-page-renderer";

export const renderDocPage = createRenderDocPage({
  docsUrl,
  versionedDocsUrl,
  absoluteUrl,
  getNavSectionForSlug,
  toRouteSlug,
  createMdxComponents,
  t,
  buildInlineVersionSwitcher,
  DocPageShell,
  DocContentHeader,
  DocMetainfoArea,
  DocHistoryArea,
});
