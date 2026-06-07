/**
 * Represents a locale switcher link.
 * Used by both SidebarFooter (Preact) and language-switcher (Preact).
 */
export interface LocaleLink {
  code: string;
  label: string;
  href: string;
  active: boolean;
}
