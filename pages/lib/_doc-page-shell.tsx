/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-page-shell (epic #2344, S5).
import { settings } from "@/config/settings";
import { createDocPageShell } from "@takazudo/zudo-doc/doc-page-shell";
import { composeMetaTitle } from "./_compose-meta-title";
import { getTocTitle } from "./_toc-title";
import { HeadWithDefaults } from "./_head-with-defaults";
import { SidebarWithDefaults } from "./_sidebar-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { SidebarPrepaint } from "./_sidebar-prepaint";
import { DocBodyEnd } from "./_doc-body-end";
import { DocPager } from "./_doc-pager";

export type { DocPageShellProps } from "@takazudo/zudo-doc/doc-page-shell";

export const DocPageShell = createDocPageShell({
  settings,
  composeMetaTitle,
  getTocTitle,
  HeadWithDefaults,
  SidebarWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  SidebarPrepaint,
  DocBodyEnd,
  DocPager,
});
