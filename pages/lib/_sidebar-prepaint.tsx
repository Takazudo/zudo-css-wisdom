/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/sidebar-prepaint (epic #2344, S5).
import { settings } from "@/config/settings";
import { createSidebarPrepaint } from "@takazudo/zudo-doc/sidebar-prepaint";

export type { SidebarPrepaintProps } from "@takazudo/zudo-doc/sidebar-prepaint";

export const SidebarPrepaint = createSidebarPrepaint({
  sidebarToggle: Boolean(settings.sidebarToggle),
});
