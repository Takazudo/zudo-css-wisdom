/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline VersionSwitcher for the breadcrumb rightSlot on doc pages.
//
// The reference site (takazudomodular.com) renders the version-switcher
// pill inline at the right of the breadcrumb row on every doc page:
//
//   <div class="mb-vsp-sm flex ... sm:justify-between [&_nav]:mb-0">
//     <breadcrumb nav>
//     <VersionSwitcher ... />
//   </div>
//
// (Wave 2 parity sweep, zudolab/zudo-doc#1478; placement fix #1534.)
// The header already shows a VersionSwitcher via _header-with-defaults.tsx;
// this helper provides the pill for the breadcrumb's `rightSlot` prop so
// both the DOM position AND the flex-row layout match the reference.
//
// Gate: only returns a non-null element when settings.versions is a
// non-empty array. When versioning is disabled the caller gets undefined
// and <Breadcrumb> renders without a rightSlot (no wrapper div emitted).

import type { JSX } from "preact";
import {
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "@takazudo/zudo-doc/i18n-version";
import { settings } from "@/config/settings";
import { defaultLocale, t, type Locale } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, withBase } from "@/utils/base";

/**
 * Build an inline VersionSwitcher element for the `<Breadcrumb rightSlot>` prop.
 *
 * Returns `undefined` when versioning is not configured (callers can pass
 * the return value directly as `rightSlot` — `<Breadcrumb>` renders the
 * plain nav (no flex wrapper, no version pill) when `rightSlot` is
 * `undefined`).
 *
 * @param slug       - Slug of the current doc page (used to build per-version URLs).
 * @param locale     - Active locale string.
 * @param currentVersion - Active version slug, or `undefined` on the "latest" route.
 */
export function buildInlineVersionSwitcher(
  slug: string,
  locale: Locale,
  currentVersion?: string,
): JSX.Element | undefined {
  if (!settings.versions || settings.versions.length === 0) return undefined;

  const isNonDefaultLocale = locale !== defaultLocale;
  const versionsPageUrl = withBase(
    isNonDefaultLocale ? `/${locale}/docs/versions` : "/docs/versions",
  );
  // The docs root index has the canonical empty slug "" (#1891), and
  // docsUrl("")/versionedDocsUrl("") resolve to the per-version docs roots —
  // so an empty slug must NOT fall back to the versions page.
  const latestUrl = docsUrl(slug, locale);

  const versionUrls: Record<string, string> = {};
  for (const v of settings.versions) {
    versionUrls[v.slug] = versionedDocsUrl(slug, v.slug, locale);
  }

  const labels: VersionSwitcherLabels = {
    latest: t("version.latest", locale),
    switcher: t("version.switcher.label", locale),
    unavailable: t("version.switcher.unavailable", locale),
    allVersions: t("version.switcher.allVersions", locale),
  };

  return (
    <VersionSwitcher
      versions={settings.versions.map((v) => ({
        slug: v.slug,
        label: v.label ?? v.slug,
      }))}
      currentVersion={currentVersion}
      latestUrl={latestUrl}
      versionsPageUrl={versionsPageUrl}
      versionUrls={versionUrls}
      labels={labels}
      idSuffix="inline"
    />
  );
}
