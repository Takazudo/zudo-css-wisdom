import { z } from "zod";
import { defineConfig } from "zfb/config";
import { settings } from "./src/config/settings";

const docsSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    sidebar_position: z.number().optional(),
    sidebar_label: z.string().optional(),
    tags: z.array(z.string()).optional(),
    search_exclude: z.boolean().optional(),
    pagination_next: z.string().nullable().optional(),
    pagination_prev: z.string().nullable().optional(),
    draft: z.boolean().optional(),
    unlisted: z.boolean().optional(),
    hide_sidebar: z.boolean().optional(),
    hide_toc: z.boolean().optional(),
    doc_history: z.boolean().optional(),
    standalone: z.boolean().optional(),
    slug: z.string().optional(),
    generated: z.boolean().optional(),
  })
  .passthrough();

const docsSchemaJson = z.toJSONSchema(docsSchema) as Record<string, unknown>;

interface CollectionEntryShape {
  name: string;
  path: string;
  schema: Record<string, unknown>;
}

const collections: CollectionEntryShape[] = [];

collections.push({ name: "docs", path: settings.docsDir, schema: docsSchemaJson });

for (const [code, config] of Object.entries(settings.locales)) {
  collections.push({ name: `docs-${code}`, path: config.dir, schema: docsSchemaJson });
}

if (settings.versions) {
  for (const version of settings.versions) {
    collections.push({
      name: `docs-v-${version.slug}`,
      path: version.docsDir,
      schema: docsSchemaJson,
    });
    if (version.locales) {
      for (const [code, config] of Object.entries(version.locales)) {
        collections.push({
          name: `docs-v-${version.slug}-${code}`,
          path: config.dir,
          schema: docsSchemaJson,
        });
      }
    }
  }
}

const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
  code,
  dir: locale.dir,
}));
const localeRecord = Object.fromEntries(
  Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
);

const integrationPlugins = [
  ...(settings.claudeResources
    ? [
        {
          name: "./plugins/claude-resources-plugin.mjs",
          options: {
            claudeDir: settings.claudeResources.claudeDir,
            projectRoot: settings.claudeResources.projectRoot,
            docsDir: settings.docsDir,
          },
        },
      ]
    : []),
  ...(settings.docHistory
    ? [
        {
          name: "./plugins/doc-history-plugin.mjs",
          options: {
            docsDir: settings.docsDir,
            locales: localeRecord,
            base: settings.base,
          },
        },
      ]
    : []),
  {
    name: "./plugins/search-index-plugin.mjs",
    options: {
      docsDir: settings.docsDir,
      locales: localeRecord,
      base: settings.base,
    },
  },
  ...(settings.llmsTxt
    ? [
        {
          name: "./plugins/llms-txt-plugin.mjs",
          options: {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            base: settings.base,
            siteUrl: settings.siteUrl,
            defaultLocaleDir: settings.docsDir,
            locales: localeArray,
          },
        },
      ]
    : []),
  {
    name: "./plugins/copy-public-plugin.mjs",
    options: {
      publicDir: "public",
    },
  },
];

export default defineConfig({
  framework: "preact",
  tailwind: { enabled: true },
  collections,
  stripMdExt: true,
  resolveMarkdownLinks: {
    enabled: true,
    dirs: [
      { dir: settings.docsDir, routePrefix: "/docs/" },
      ...Object.entries(settings.locales).map(([code, locale]) => ({
        dir: locale.dir,
        routePrefix: `/${code}/docs/`,
      })),
      // Versioned collections: each version's EN dir + per-locale dirs.
      ...(settings.versions
        ? settings.versions.flatMap((version) => [
            { dir: version.docsDir, routePrefix: `/v/${version.slug}/docs/` },
            ...Object.entries(version.locales ?? {}).map(([code, locale]) => ({
              dir: locale.dir,
              routePrefix: `/v/${version.slug}/${code}/docs/`,
            })),
          ])
        : []),
    ],
    onBrokenLinks: "warn",
  },
  base: settings.base,
  trailingSlash: settings.trailingSlash,
  markdown: {
    features: {
      // Former-Core features (were always-on before zfb next.12).
      // imageEnlarge was a former-Core feature but was hard-removed in zfb
      // next.18 — it is now re-implemented via an MDX p-override.
      // Admonitions recipe: register the :::name directive vocabulary
      // (note/tip/info/warning/danger/caution/details) → components.
      directives: {
        note: "Note",
        tip: "Tip",
        info: "Info",
        warning: "Warning",
        danger: "Danger",
        caution: "Caution",
        details: "Details", // collapsible — routes to DetailsWrapper
      },
      mermaid: true,
      headingMarkerToc: true,
      // Safe opt-in features.
      githubAlerts: true,
      readingTime: true,
      codeEnrichment: {},
      codeTabs: true,
      imageDimensions: {},
      // warn-only link validation — failOnBroken: false never fails the build.
      linkValidation: { failOnBroken: false },
      // Heading-ID (anchor) strategy — single source of truth in
      // settings.headingIdStrategy, also mirrored by the host TOC builder
      // (pages/lib/_extract-headings.ts) so TOC anchors match rendered ids.
      headingIds: { strategy: settings.headingIdStrategy },
    },
  },
  plugins: integrationPlugins,
});
