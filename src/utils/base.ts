import { settings } from "@/config/settings";
import { defaultLocale, locales, getLocaleLabel, type Locale } from "@/config/i18n";
import type { LocaleLink } from "@/types/locale";

/** Normalized base path with no trailing slash (empty string when "/"). */
export const normalizedBase = settings.base.replace(/\/+$/, "");

/**
 * Append a trailing slash to page URLs when `settings.trailingSlash` is true.
 * Skips paths that already end with `/`, contain a file extension, or have a
 * query string / fragment before the slash would be inserted.
 */
export function applyTrailingSlash(url: string): string {
  if (!settings.trailingSlash) return url;
  if (url.endsWith("/")) return url;
  // Split off query string and fragment
  const suffixIdx = url.search(/[?#]/);
  const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
  const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
  if (pathPart.endsWith("/")) return url;
  // Check file extension on the last path segment only, requiring the extension
  // to start with a letter to avoid false positives on version-like paths (e.g. /docs/v2.0)
  const lastSegment = pathPart.split("/").pop() ?? "";
  if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
  return pathPart + "/" + suffix;
}

/** Prefix a path with the configured base directory. */
export function withBase(path: string): string {
  const raw =
    normalizedBase === ""
      ? path
      : `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
  return applyTrailingSlash(raw);
}

/** Strip the base prefix from a URL pathname. */
export function stripBase(path: string): string {
  if (normalizedBase === "") return path;
  // Require a segment boundary so base "/app" doesn't strip "/application/...".
  if (path === normalizedBase) return "/";
  return path.startsWith(`${normalizedBase}/`)
    ? path.slice(normalizedBase.length)
    : path;
}

/**
 * Build an absolute URL by joining `settings.siteUrl` (trailing slash stripped)
 * with a base-prefixed page path. Returns `undefined` when `siteUrl` is unset
 * (e.g. a freshly scaffolded project), so callers can skip emitting a useless
 * relative canonical / og:image. Replaces the `siteUrl.replace(/\/$/, "") +
 * pageUrl` pattern that was copy-pasted across the 4 doc routes and
 * `_head-with-defaults.tsx` (#1917).
 */
export function absoluteUrl(pageUrl: string): string | undefined {
  return settings.siteUrl ? settings.siteUrl.replace(/\/$/, "") + pageUrl : undefined;
}

/** Build a docs URL for the given slug and lang. */
export function docsUrl(slug: string, lang: Locale | string = defaultLocale): string {
  const path = lang === defaultLocale ? `/docs/${slug}` : `/${lang}/docs/${slug}`;
  return withBase(path);
}

/** Check if a URL is external (starts with http:// or https://). */
export function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/** Resolve a href: external URLs pass through, internal ones get the base prefix. */
export function resolveHref(href: string): string {
  return isExternal(href) ? href : withBase(href);
}

/**
 * Build a localized, versioned nav href.
 * Uses /v/{version}/{lang}/... ordering — the only shape the routing layer
 * serves (pages/v/[version]/ja/docs/...), matching versionedDocsUrl().
 * The /{lang}/v/{version}/... ordering has no route and 404s.
 */
export function navHref(
  path: string,
  lang: Locale | undefined,
  currentVersion: string | undefined,
): string {
  const isNonDefaultLocale = lang != null && lang !== defaultLocale;
  const versionPrefix = currentVersion ? `/v/${currentVersion}` : "";
  return withBase(
    isNonDefaultLocale
      ? `${versionPrefix}/${lang}${path}`
      : `${versionPrefix}${path}`,
  );
}

/**
 * Split a leading /v/{version} prefix off a base-stripped path.
 * Versioned routes nest the locale AFTER the version (/v/1.0/ja/docs/...),
 * so locale stripping/prefixing must operate on the remainder only.
 */
function splitVersionPrefix(path: string): { versionPrefix: string; rest: string } {
  const m = path.match(/^(\/v\/[^/]+)(\/.*|$)/);
  return m ? { versionPrefix: m[1] ?? "", rest: m[2] ?? "/" } : { versionPrefix: "", rest: path };
}

/** Build a locale-switched path from the current page path. */
export function getPathForLocale(
  path: string,
  currentLang: Locale,
  targetLang: Locale,
): string {
  const { versionPrefix, rest } = splitVersionPrefix(stripBase(path));
  let relativePath = rest;
  if (currentLang !== defaultLocale) {
    relativePath = relativePath.replace(new RegExp(`^/${currentLang}(?:/|$)`), "/");
  }
  if (targetLang !== defaultLocale) {
    relativePath = `/${targetLang}${relativePath}`;
  }
  return withBase(`${versionPrefix}${relativePath}`);
}

/** Build locale links for locale switcher UI components. */
export function buildLocaleLinks(currentPath: string, currentLang: Locale): LocaleLink[] {
  let defaultLocalePath = splitVersionPrefix(stripBase(currentPath)).rest;
  if (currentLang !== defaultLocale) {
    defaultLocalePath = defaultLocalePath.replace(new RegExp(`^/${currentLang}(?:/|$)`), "/");
  }
  if (isDefaultLocaleOnlyPath(defaultLocalePath)) {
    return [{
      code: currentLang,
      label: getLocaleLabel(currentLang),
      href: getPathForLocale(currentPath, currentLang, currentLang),
      active: true,
    }];
  }
  return locales.map((code) => ({
    code,
    label: getLocaleLabel(code),
    href: getPathForLocale(currentPath, currentLang, code),
    active: code === currentLang,
  }));
}

/**
 * Returns true when the given default-locale-shaped path falls under one of
 * the configured `defaultLocaleOnlyPrefixes`.  Callers that work with
 * locale-prefixed paths (e.g. `/ja/docs/...`) are responsible for stripping
 * the locale segment before calling this function.  The path is normalized to
 * end with `/` before the comparison so the helper is robust to projects that
 * disable `settings.trailingSlash` (where `docsUrl` returns slashless paths).
 */
export function isDefaultLocaleOnlyPath(path: string): boolean {
  const stripped = stripBase(path);
  const normalized = stripped.endsWith("/") ? stripped : `${stripped}/`;
  return settings.defaultLocaleOnlyPrefixes.some((prefix) => normalized.startsWith(prefix));
}

/** Build a versioned docs URL for the given slug, version, and lang. */
export function versionedDocsUrl(slug: string, versionSlug: string, lang: Locale = defaultLocale): string {
  const path = lang === defaultLocale
    ? `/v/${versionSlug}/docs/${slug}`
    : `/v/${versionSlug}/${lang}/docs/${slug}`;
  return withBase(path);
}
