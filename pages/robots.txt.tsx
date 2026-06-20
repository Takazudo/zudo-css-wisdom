// Prerendered robots.txt page route, gated by settings.noindex.
//
// Filename → output extension mapping (zfb convention): the
// second-to-last `.`-separated segment of the stem becomes the output
// extension, so `robots.txt.tsx` builds `dist/robots.txt`. The
// explicit `contentType` export pins the dev-server Content-Type
// header to `text/plain` regardless of the filename hint.

import { settings } from "@/config/settings";

export const frontmatter = { title: "Robots" };
export const contentType = "text/plain";

export default function Robots(): string {
  if (settings.noindex) {
    // noindex: disallow all crawlers. Omit Sitemap: — advertising a sitemap
    // while disallowing all crawlers is contradictory.
    return `User-agent: *\nDisallow: /\n`;
  }

  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");
  const hasSitemapLine = siteUrlBase !== "" && settings.sitemap;

  const sitemapLine = hasSitemapLine
    ? `Sitemap: ${siteUrlBase}/sitemap.xml\n`
    : "";

  return `User-agent: *\nAllow: /\n${sitemapLine}`;
}
