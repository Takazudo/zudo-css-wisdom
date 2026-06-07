/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";

export interface TailwindPreviewProps {
  html: string;
  css?: string;
  title?: string;
  height?: number;
  defaultOpen?: boolean;
  /**
   * Tailwind Play CDN plugin slugs (e.g. `["forms", "typography"]`). There is
   * no HtmlPreview equivalent — we build the `?plugins=` query string here.
   */
  plugins?: string[];
}

// The Tailwind Play CDN script. Injected via `globalConfig.head` (inject-only)
// so it is NOT echoed into a spurious "Head" code panel — the original
// component only ever showed HTML + CSS. Because the merged head contains a
// `<script>`, HtmlPreview's `containsScript` check auto-selects the
// `allow-scripts allow-same-origin` sandbox and a 300ms syncDelay, matching
// the original TailwindPreview behavior.
function buildTailwindHead(plugins?: string[]): string {
  const pluginQuery =
    plugins && plugins.length > 0 ? `?plugins=${plugins.join(",")}` : "";
  return `<script src="https://cdn.tailwindcss.com${pluginQuery}"></script>`;
}

/**
 * Alias shim: zcss `<TailwindPreview>` → upstream `HtmlPreviewWrapper`.
 *
 * Plain prop-transforming forwarder — it does NOT call `Island()` and has no
 * bare `…Inner` of its own. `HtmlPreviewWrapper` already owns the
 * `Island({ when: "visible" })` boundary and the no-double-wrap invariant
 * (see @takazudo/zudo-doc html-preview-wrapper.tsx). Wrapping again here would
 * emit a second `data-zfb-island` marker and reparent the preview into the
 * title bar (the zudo-doc#1925 / #1355 regression). Same pattern as
 * `CodeGroup → Tabs`.
 *
 * `css` (optional) is forwarded as the per-usage `css` prop so it is injected
 * as a `<style>` AND rendered as the CSS code block. The Tailwind CDN script
 * goes through `globalConfig.head`.
 */
export default function TailwindPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
  plugins,
}: TailwindPreviewProps): VNode {
  return (
    <HtmlPreviewWrapper
      globalConfig={{ head: buildTailwindHead(plugins) }}
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
    />
  );
}
