"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { HtmlPreviewWrapperInner } from "@takazudo/zudo-doc/html-preview-wrapper";

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
 * Bare hydration target for the `<TailwindPreview>` island.
 *
 * Renders the package's BARE `HtmlPreviewWrapperInner` (no `Island()` of its
 * own) so the public `TailwindPreview` provides exactly ONE `Island()`
 * boundary (no double-wrap). `displayName` MUST equal the export name.
 */
export function TailwindPreviewInner({
  html,
  css,
  title,
  height,
  defaultOpen,
  plugins,
}: TailwindPreviewProps): VNode {
  return (
    <HtmlPreviewWrapperInner
      globalConfig={{ head: buildTailwindHead(plugins) }}
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
    />
  );
}
TailwindPreviewInner.displayName = "TailwindPreviewInner";

/**
 * zcss `<TailwindPreview>` → a real zfb island.
 *
 * Like `CssPreview`, the `Island()` call lives HERE (project source) so zfb's
 * island scanner includes `TailwindPreviewInner` in the client bundle and the
 * preview hydrates (a plain forwarder to the package wrapper SSRs but does not
 * hydrate — caught by the S6 gate). `css` (optional) is forwarded as the
 * per-usage `css` prop; the Tailwind CDN `<script>` goes through
 * `globalConfig.head`, which flips the sandbox to `allow-scripts
 * allow-same-origin` + syncDelay 300.
 */
export default function TailwindPreview(props: TailwindPreviewProps): VNode {
  return Island({
    when: "visible",
    children: <TailwindPreviewInner {...props} />,
  }) as VNode;
}
