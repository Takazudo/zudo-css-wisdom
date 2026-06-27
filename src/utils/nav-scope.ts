// Host thin-stub for nav-scope utilities (epic #2344, S5).
// Core logic lives in @takazudo/zudo-doc/nav-scope; this stub wires
// the host's `settings.headerNav` singleton.
import { settings } from "@/config/settings";
import type { NavNode } from "@/utils/docs";
export type { HeaderNavItem } from "@/config/settings";

import {
  getCategoryOrder as _getCategoryOrder,
  getNavSectionForSlug as _getNavSectionForSlug,
  getNavSubtree as _getNavSubtree,
} from "@takazudo/zudo-doc/nav-scope";

/** Collect all categoryMatch strings from headerNav, including children (ordered). */
export function getCategoryOrder(): string[] {
  return _getCategoryOrder(settings.headerNav);
}

/**
 * Given a doc's slug, return the categoryMatch value of the headerNav item it belongs to.
 */
export function getNavSectionForSlug(slug: string): string | undefined {
  return _getNavSectionForSlug(slug, settings.headerNav);
}

/**
 * Filter top-level NavNodes by a headerNav categoryMatch value.
 */
export function getNavSubtree(
  tree: NavNode[],
  categoryMatch?: string,
): NavNode[] {
  return _getNavSubtree(tree, categoryMatch, settings.headerNav);
}
