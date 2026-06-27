// Host thin-stub for sidebar utilities (epic #2344, S5).
// Core logic lives in @takazudo/zudo-doc/sidebar-utils; this stub wires
// the host's singletons (sidebars config, getCategoryOrder for the "!" filter).
import sidebars from "@/config/sidebars";
import type { SidebarItem } from "@/config/sidebars";
import type { NavNode, CategoryMeta } from "@/utils/docs";
import { buildNavTree } from "@/utils/docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import type { Locale } from "@/config/i18n";
import type { DocsEntry } from "@/types/docs-entry";
import { buildSidebarForSection as _buildSidebarForSection } from "@takazudo/zudo-doc/sidebar-utils";

export type { SidebarItem };

/**
 * Build sidebar nodes for a given nav section.
 * If sidebar config exists for this section, use it.
 * Otherwise fall back to auto-generated tree.
 */
export function buildSidebarForSection(
  docs: DocsEntry[],
  lang: Locale,
  categoryMatch?: string,
  categoryMeta?: Map<string, CategoryMeta>,
): NavNode[] {
  const explicitPrefixes = getCategoryOrder().filter((cm) => cm !== "!");
  return _buildSidebarForSection(
    docs,
    lang,
    categoryMatch,
    categoryMeta,
    sidebars,
    (d, l, meta) => buildNavTree(d as DocsEntry[], l as Locale, meta as Map<string, CategoryMeta>),
    explicitPrefixes,
  ) as NavNode[];
}
