// Port of `src/integrations/sitemap.ts` onto zfb's pages-style filename
// convention.
//
// Filename → output extension mapping (zfb convention): the
// second-to-last `.`-separated segment of the stem becomes the output
// extension, so `sitemap.xml.tsx` builds `dist/sitemap.xml`. The
// explicit `contentType` export pins the dev-server `Content-Type`
// header to `application/xml` regardless of the filename hint.
//
// URL enumeration is delegated to `pages/lib/route-enumerators.ts` so
// the sitemap cannot drift from the actual routes the page modules build.
// Previously the sitemap walked raw collection slugs directly and missed:
//   (a) tag pages           (b) JA fallback URLs
//   (c) versioned JA routes (d) wrong URL pattern for versioned-locale pages
//   (e) emitted /index/ suffix on category pages (closes #690)

import { settings } from "@/config/settings";
import { enumerateAllRoutes } from "./lib/route-enumerators";

export const frontmatter = { title: "Sitemap" };
export const contentType = "application/xml";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function Sitemap(): string {
  const routeMap = enumerateAllRoutes();
  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");

  const urlEntries = [...routeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([url, lastmod]) => `  <url>
    <loc>${escapeXml(siteUrlBase + url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}
