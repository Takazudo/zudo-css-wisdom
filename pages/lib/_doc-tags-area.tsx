/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware DocTags area wrapper for the zfb doc pages.
//
// Renders the page-level tag chips (e.g. "Tags: #customization") between
// the DocMetainfo block and the description paragraph (doc-tags placement
// — after-title, between the date block and description paragraph).
//
// Restoration of a Astro→zfb migration regression: the DocTags component
// was correctly ported into @takazudo/zudo-doc/metainfo/doc-tags.tsx
// but no page template wired it up (#1658, closes #1508).
//
// tagHref logic: inlined from _footer-with-defaults.tsx (the `tagHref`
// helper there). Extraction was considered but would cause ripple in the
// footer file and its callers — per the spec's "no opportunistic refactor"
// rule, a local copy is used here instead.
//
// i18n: both `doc.tags` and `doc.taggedWith` are confirmed present for all
// project locales (en, ja, de) in src/config/i18n.ts — no fallback needed.

import type { VNode } from "preact";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { resolvePageTags } from "@/utils/tags";
import { DocTags } from "@takazudo/zudo-doc/metainfo";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the base-prefixed tag detail page href for the given locale.
 *
 * Inlined from _footer-with-defaults.tsx `tagHref` — not extracted to avoid
 * ripple (spec rule: no opportunistic refactor on tagHref extraction).
 *
 * The tag segment is URL-encoded at the href site only — route params stay
 * raw, so the built output dir keeps the raw tag name and the server decodes
 * the percent-encoded href back to it (e.g. "type:guide" → "type%3Aguide").
 */
function tagHref(tag: string, locale: string): string {
  const encoded = encodeURIComponent(tag);
  const path =
    locale === defaultLocale
      ? `/docs/tags/${encoded}`
      : `/${locale}/docs/tags/${encoded}`;
  return withBase(path);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DocTagsAreaProps {
  /** Page slug, e.g. "guides/sidebar". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /** Raw tag strings from the page frontmatter (entry.data.tags). */
  tags: readonly string[] | undefined;
}

/**
 * Renders the page-level tag chip block when `settings.docTags` is enabled
 * and the page has at least one resolved (non-deprecated) tag.
 *
 * Returns null when `docTags` is disabled, the page has no tags, or all
 * raw tags resolve to deprecated entries.
 *
 * Placement is "after-title" (between the date block and description paragraph).
 */
export function DocTagsArea({ locale, tags }: DocTagsAreaProps): VNode | null {
  if (!settings.docTags) return null;

  const rawTags = tags ?? [];
  const canonicalTags = resolvePageTags(rawTags);
  if (canonicalTags.length === 0) return null;

  const resolvedTags = canonicalTags.map((tag) => ({
    tag,
    href: tagHref(tag, locale),
  }));

  return (
    <DocTags
      placement="after-title"
      tags={resolvedTags}
      tagsLabel={t("doc.tags", locale)}
      taggedWithLabel={t("doc.taggedWith", locale)}
    />
  );
}
