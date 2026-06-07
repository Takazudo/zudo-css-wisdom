/**
 * Compose the canonical "<title> | <siteName>" page-title shape used by
 * both <title> (emitted by DocLayout) and og:title (emitted by
 * HeadWithDefaults).
 *
 * Why this exists: the legacy Astro layout synthesised this suffix
 * inline. The zfb DocLayout shell intentionally renders only what the
 * host passes as `title`, so the host has to compose the suffix itself.
 * Centralising the composition in one helper keeps every host call
 * site in sync and matches the SEO/UX-recognised shape the original
 * site shipped (also asserted by smoke-seo.spec.ts).
 *
 * Edge cases:
 * - When `title` is identical to `settings.siteName` (e.g. the home
 *   page already passes `settings.siteName` as the title), do NOT
 *   duplicate — return just the bare site name. Mirrors the legacy
 *   Astro behaviour.
 * - When `siteName` is missing/empty (defensive — settings.ts always
 *   has it in practice), fall back to the bare title.
 *
 */
import { settings } from "@/config/settings";

export function composeMetaTitle(title: string): string {
  const siteName = settings.siteName;
  if (!siteName) return title;
  if (title === siteName) return siteName;
  return `${title} | ${siteName}`;
}
