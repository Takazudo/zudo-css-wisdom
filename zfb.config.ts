import { defineConfig } from "zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { settings } from "./src/config/settings";
import { buildDocsSchema } from "./src/config/docs-schema";
import { translations } from "./src/config/i18n";
import { colorSchemes } from "./src/config/color-schemes";

// The seven canonical directives registered in pages/_mdx-components.ts.
// "details" routes to DetailsWrapper — a collapsible, NOT an admonition.
const directiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details",
};

export default defineConfig({
  // ── Host-owned shell fields ──────────────────────────────────────────────
  framework: "preact",
  // Pin the dev/preview port — zfb defaults to 3000, but this project's
  // CLAUDE.md and local dev setup assume 8811.
  port: 8811,
  tailwind: { enabled: true },
  // Public URL prefix for <link rel="stylesheet"> and <script> tags.
  base: settings.base,
  // Cloudflare adapter — required for the Workers deploy and any
  // non-prerendered (package-owned api-ai-chat) routes. Bindings via wrangler.toml.
  adapter: "@takazudo/zfb-adapter-cloudflare",

  // ── Preset-owned fields (content collections, plugins, markdown,
  //    codeHighlight, resolveMarkdownLinks, trailingSlash, package-owned routes) ──
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes }),
});
