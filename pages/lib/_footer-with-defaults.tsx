/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware Footer wrapper for the zfb doc pages.
//
// Footer data-prep utilities — reads settings.footer, localizes link
// hrefs and titles, and optionally collects tag columns when taglist is
// enabled — then feeds the result into the presentational <Footer> shell
// from @takazudo/zudo-doc/footer.
//
// Callers pass a `lang` prop (the active locale string, e.g. "en", "ja").
// The component returns a fully populated <Footer> when settings.footer is
// configured, or a bare <Footer /> shell when it is not (the shell still
// emits the contentinfo ARIA landmark).
//
// Data-prep helpers used:
//   settings.footer            — link columns, copyright, taglist config
//   isExternal / resolveHref / withBase  — href normalization
//   defaultLocale              — determines when locale prefix is needed
//   tagVocabulary              — group-by ordering for grouped taglist mode
//   collectTags                — builds tag → { count, docs } map
//   toRouteSlug                — derives route slug from collection id
//   loadDocs / filterDrafts    — synchronous zfb collection helpers (ADR-004)

import type { VNode } from "preact";
import { settings } from "@/config/settings";
import { Footer } from "@takazudo/zudo-doc/footer";
import type { FooterLinkColumn, FooterTagColumn } from "@takazudo/zudo-doc/footer";
import { isExternal, resolveHref, withBase } from "@/utils/base";
import { defaultLocale } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { loadDocs } from "../_data";
import { mergeLocaleDocs } from "./locale-merge";
import type { DocsEntry } from "@/types/docs-entry";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Prefix an internal href with the locale path for non-default locales,
 * then apply the configured base prefix. External hrefs pass through.
 */
function localizeHref(href: string, lang: string): string {
  if (isExternal(href)) return href;
  if (lang !== defaultLocale) {
    const path = href.startsWith("/") ? href : `/${href}`;
    return resolveHref(`/${lang}${path}`);
  }
  return resolveHref(href);
}

/** Build the base-prefixed tag detail page href for the given locale. */
function tagHref(tag: string, lang: string): string {
  const path =
    lang === defaultLocale
      ? `/docs/tags/${tag}`
      : `/${lang}/docs/tags/${tag}`;
  return withBase(path);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FooterWithDefaultsProps {
  /** Active locale string, e.g. "en", "ja". Defaults to defaultLocale. */
  lang?: string;
}

/**
 * Locale-aware Footer wrapper.
 *
 * Reads settings.footer and assembles the linkColumns / tagColumns /
 * copyright props expected by the presentational <Footer> shell.  When
 * settings.footer is false, a bare <Footer /> shell is returned (the
 * contentinfo ARIA landmark is still present).
 */
export function FooterWithDefaults({
  lang = defaultLocale,
}: FooterWithDefaultsProps): VNode {
  const footer = settings.footer;

  // Locale-keyed persist key: same-locale swaps preserve DOM identity;
  // cross-locale swaps discard the stale footer and re-render. (#1546)
  const persistKey = `footer-${lang}`;

  // When footer is not configured, return the bare shell so the
  // contentinfo ARIA landmark is present.
  if (!footer) {
    return <Footer persistKey={persistKey} />;
  }

  const { links, copyright, taglist } = footer;

  // ── Link columns ────────────────────────────────────────────────────────

  const linkColumns: FooterLinkColumn[] = links.map((column) => ({
    title: (column.locales as Record<string, { title: string }> | undefined)?.[lang]?.title ?? column.title,
    items: column.items.map((item) => ({
      label: (item.locales as Record<string, { label: string }> | undefined)?.[lang]?.label ?? item.label,
      href: localizeHref(item.href, lang),
      isExternal: isExternal(item.href),
    })),
  }));

  // ── Tag columns (optional) ───────────────────────────────────────────────

  let tagColumns: FooterTagColumn[] = [];

  if (taglist?.enabled) {
    // Load docs synchronously (zfb ADR-004 — synchronous content snapshot).
    let docs: DocsEntry[];
    if (lang === defaultLocale) {
      docs = loadDocs("docs").filter((d) => !d.data.draft && !d.data.unlisted);
    } else {
      // Apply the default-locale-only filter so the footer taglist only counts
      // tags that have a locale-routable tag page — matching the tag-route
      // pages ([tag].tsx / tags/index.tsx) and enumerateTagsRoutes, which all
      // now filter. Without this, the footer would link to /{locale}/docs/tags/
      // pages that are never built for tags living only on default-locale-only
      // prefix pages.
      const result = mergeLocaleDocs({
        baseDocs: loadDocs("docs").filter((d) => !d.data.draft),
        localeDocs: loadDocs(`docs-${lang}`).filter((d) => !d.data.draft),
        applyDefaultLocaleOnlyFilter: true,
      });
      docs = result.docs;
    }

    const tagMap = collectTags(
      docs,
      (id, data) => data.slug ?? toRouteSlug(id),
    );
    const allTags = [...tagMap.values()].sort((a, b) =>
      a.tag.localeCompare(b.tag, lang),
    );

    const vocabularyActive =
      Boolean(settings.tagVocabulary) && settings.tagGovernance !== "off";
    const requestedGroupBy = taglist.groupBy ?? "group";
    const effectiveGroupBy = vocabularyActive ? requestedGroupBy : "flat";

    const localeOverrides = (taglist.locales as Record<string, { title?: string; groupTitles?: Record<string, string> }> | undefined)?.[lang];
    const groupTitles: Record<string, string> = {
      ...taglist.groupTitles,
      ...localeOverrides?.groupTitles,
    };
    const flatTitle = localeOverrides?.title ?? taglist.title ?? "Tags";

    if (effectiveGroupBy === "flat" || !vocabularyActive) {
      if (allTags.length > 0) {
        tagColumns = [
          {
            group: "__flat__",
            title: flatTitle,
            tags: allTags.map(({ tag, count }) => ({
              tag,
              count,
              href: tagHref(tag, lang),
            })),
          },
        ];
      }
    } else {
      // Grouped mode: one column per vocabulary group, in declaration order.
      const groupByCanonical = new Map<string, string>();
      const groupOrder: string[] = [];
      const seenGroups = new Set<string>();
      for (const entry of tagVocabulary) {
        if (!entry.group) continue;
        groupByCanonical.set(entry.id, entry.group);
        if (!seenGroups.has(entry.group)) {
          seenGroups.add(entry.group);
          groupOrder.push(entry.group);
        }
      }

      const buckets = new Map<string, typeof allTags>();
      for (const group of groupOrder) buckets.set(group, []);
      const ungrouped: typeof allTags = [];

      for (const info of allTags) {
        const group = groupByCanonical.get(info.tag);
        if (group && buckets.has(group)) {
          buckets.get(group)!.push(info);
        } else {
          ungrouped.push(info);
        }
      }

      tagColumns = groupOrder
        .filter((g) => (buckets.get(g)?.length ?? 0) > 0)
        .map((g) => ({
          group: g,
          title:
            groupTitles[g] ??
            g.charAt(0).toUpperCase() + g.slice(1),
          tags: buckets.get(g)!.map(({ tag, count }) => ({
            tag,
            count,
            href: tagHref(tag, lang),
          })),
        }));

      if (ungrouped.length > 0) {
        tagColumns.push({
          group: "__flat__",
          title: flatTitle,
          tags: ungrouped.map(({ tag, count }) => ({
            tag,
            count,
            href: tagHref(tag, lang),
          })),
        });
      }
    }
  }

  return (
    <Footer
      linkColumns={linkColumns}
      tagColumns={tagColumns}
      copyright={copyright}
      persistKey={persistKey}
    />
  );
}
