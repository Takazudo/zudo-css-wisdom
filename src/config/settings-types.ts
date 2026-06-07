export interface HeaderNavChildItem {
  label: string;
  labelKey?: string;
  path: string;
  categoryMatch?: string;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  children?: HeaderNavChildItem[];
}

export type HeaderRightComponentName =
  | "theme-toggle"
  | "language-switcher"
  | "version-switcher"
  | "github-link"
  | "search";

export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";

export interface HeaderRightComponentItem {
  type: "component";
  component: HeaderRightComponentName;
}

export interface HeaderRightTriggerItem {
  type: "trigger";
  trigger: HeaderRightTriggerName;
}

export interface HeaderRightLinkItem {
  type: "link";
  href: string;
  label?: string;
  ariaLabel?: string;
  icon?: "github";
}

export interface HeaderRightHtmlItem {
  type: "html";
  html: string;
}

export type HeaderRightItem =
  | HeaderRightComponentItem
  | HeaderRightTriggerItem
  | HeaderRightLinkItem
  | HeaderRightHtmlItem;

export interface BodyFootUtilAreaConfig {
  docHistory?: boolean;
  viewSourceLink?: boolean;
}

export interface ColorModeConfig {
  defaultMode: "light" | "dark";
  lightScheme: string;
  darkScheme: string;
  respectPrefersColorScheme: boolean;
}

export interface LocaleConfig {
  label: string;
  dir: string;
}

export interface FooterLinkItem {
  label: string;
  href: string;
  locales?: Record<string, { label: string }>;
}

export interface FooterLinkColumn {
  title: string;
  items: FooterLinkItem[];
  locales?: Record<string, { title: string }>;
}

/**
 * Per-locale overrides for the footer taglist labels.
 *
 * `title`        — overrides `taglist.title` on this locale.
 * `groupTitles`  — per-group title overrides keyed by vocabulary `group`.
 */
export interface FooterTaglistLocaleConfig {
  title?: string;
  groupTitles?: Record<string, string>;
}

/**
 * Opt-in footer tag index.
 *
 * Renders one or more columns of tag links inside the existing footer grid.
 * Off by default: when `enabled: false` (or the field is omitted entirely),
 * the footer renders unchanged.
 *
 * - `groupBy: "group"` — one column per vocabulary `group`, in the order the
 *   groups first appear in `tag-vocabulary.ts`. Each column's title comes from
 *   `groupTitles[group]`, falling back to a capitalised version of the group
 *   name.
 * - `groupBy: "flat"` — a single column titled `title` listing every tag
 *   alphabetically. This is also the fallback used when the vocabulary is
 *   inactive (`tagVocabulary: false` or `tagGovernance: "off"`).
 */
export interface FooterTaglistConfig {
  enabled: boolean;
  /** Column title used in flat mode (and as fallback for ungrouped tags). */
  title?: string;
  /** Default `"group"` when the vocabulary is active, otherwise forced to `"flat"`. */
  groupBy?: "group" | "flat";
  /** English (default-locale) group titles, e.g. `{ type: "By type" }`. */
  groupTitles?: Record<string, string>;
  /** Locale-specific overrides for `title` and `groupTitles`. */
  locales?: Record<string, FooterTaglistLocaleConfig>;
}

export interface FooterConfig {
  links: FooterLinkColumn[];
  /** Copyright text displayed at the bottom of the footer. HTML is supported. */
  copyright?: string;
  /** Opt-in footer tag index. Off by default. */
  taglist?: FooterTaglistConfig;
}

export interface HtmlPreviewConfig {
  /** Raw HTML injected into <head> (links, meta, fonts) */
  head?: string;
  /** CSS injected as <style> after preflight */
  css?: string;
  /** JS injected as <script> before </body> */
  js?: string;
}

export interface FrontmatterPreviewConfig {
  /**
   * Completely replaces the default ignore list.
   * When set, `extraIgnoreKeys` is ignored.
   */
  ignoreKeys?: string[];
  /**
   * Additional keys to ignore on top of the defaults.
   * Has no effect when `ignoreKeys` is also set.
   */
  extraIgnoreKeys?: string[];
}

export type TagPlacement = "after-title" | "before-pager";

export type { TagGovernanceMode, TagVocabularyEntry } from "./tag-vocabulary-types";

export interface VersionConfig {
  /** Version identifier, used in URL path (e.g., "1.0", "v1") */
  slug: string;
  /** Display label (e.g., "1.0.0", "Version 1") */
  label: string;
  /** Content directory for this version's English docs */
  docsDir: string;
  /** Per-locale content directories for this version */
  locales?: Record<string, { dir: string }>;
  /** Banner text shown on versioned pages (e.g., "unmaintained", "unreleased") */
  banner?: "unmaintained" | "unreleased" | false;
}
