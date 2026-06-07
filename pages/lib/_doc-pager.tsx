/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared prev/next pager <nav> for doc pages.
//
// Extracted from the four doc-route render bodies (pages/docs/[...slug].tsx,
// pages/[locale]/docs/[...slug].tsx, pages/v/[version]/docs/[...slug].tsx,
// pages/v/[version]/[locale]/docs/[...slug].tsx) where the block was
// duplicated verbatim.
//
// Uses ChevronLeft / ChevronRight from the shared icon module
// (@takazudo/zudo-doc/icons) rather than hand-written SVG paths, absorbing
// the last inline chevron occurrences in the route files (see #1880 item 4).

import type { JSX } from "preact";
import { t } from "@/config/i18n";
import { ChevronLeft, ChevronRight } from "@takazudo/zudo-doc/icons";

// NavNode is a superset; we only need the fields the pager uses.
interface PagerNode {
  href?: string;
  label: string;
}

interface DocPagerProps {
  /** Previous page node (null = no previous page → renders placeholder). */
  prev: PagerNode | null;
  /** Next page node (null = no next page → renders placeholder). */
  next: PagerNode | null;
  /** Active locale for translated "Previous" / "Next" labels. */
  locale: string;
}

/**
 * Prev/next pagination nav shared by all four doc-route page components.
 *
 * Renders a two-column grid: prev card on the left, next card on the right.
 * When a node is absent its slot is filled with an empty `<div>` to maintain
 * the two-column layout. Placement: immediately after MDX content, before
 * `DocHistoryArea` (Astro reference order — content → pager → utilities,
 * per #1535).
 */
export function DocPager({ prev, next, locale }: DocPagerProps): JSX.Element {
  return (
    <nav class="mt-vsp-2xl grid grid-cols-2 gap-hsp-xl">
      {prev ? (
        <a
          href={prev.href}
          class="group border border-muted rounded-lg p-hsp-lg hover:border-accent"
        >
          <div class="flex items-center gap-hsp-xs text-caption text-muted mb-vsp-2xs">
            <ChevronLeft className="h-[1.125rem] w-[1.125rem]" />
            <span class="no-underline">{t("nav.previous", locale)}</span>
          </div>
          <p class="text-small font-semibold underline group-hover:text-accent">
            {prev.label}
          </p>
        </a>
      ) : (
        <div />
      )}
      {next ? (
        <a
          href={next.href}
          class="group border border-muted rounded-lg p-hsp-lg hover:border-accent text-right"
        >
          <div class="flex items-center justify-end gap-hsp-xs text-caption text-muted mb-vsp-2xs">
            <span class="no-underline">{t("nav.next", locale)}</span>
            <ChevronRight className="h-[1.125rem] w-[1.125rem]" />
          </div>
          <p class="text-small font-semibold underline group-hover:text-accent">
            {next.label}
          </p>
        </a>
      ) : (
        <div />
      )}
    </nav>
  );
}
