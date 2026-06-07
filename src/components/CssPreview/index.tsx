/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";

export interface CssPreviewProps {
  html: string;
  css: string;
  title?: string;
  height?: number;
  defaultOpen?: boolean;
}

// zcss's CssPreview injects `html, body { height: 100% }` into every demo
// srcdoc so full-height-centering demos work; upstream HtmlPreview does NOT.
// Passed via `globalConfig.head` (inject-only) rather than the per-usage
// `head` prop so the rule is NOT echoed into a spurious "Head" code panel —
// the original component only ever showed HTML + CSS.
const CSS_PREVIEW_HEAD = "<style>html, body { height: 100%; }</style>";

/**
 * Alias shim: zcss `<CssPreview>` → upstream `HtmlPreviewWrapper`.
 *
 * Plain prop-transforming forwarder — it does NOT call `Island()` and has no
 * bare `…Inner` of its own. `HtmlPreviewWrapper` already owns the
 * `Island({ when: "visible" })` boundary and the no-double-wrap invariant
 * (see @takazudo/zudo-doc html-preview-wrapper.tsx). Wrapping again here would
 * emit a second `data-zfb-island` marker and reparent the preview into the
 * title bar (the zudo-doc#1925 / #1355 regression). Same pattern as
 * `CodeGroup → Tabs`.
 *
 * `css` is forwarded as the per-usage `css` prop, so HtmlPreview both injects
 * it as a `<style>` and renders it as the CSS code block. sandbox resolves to
 * `allow-same-origin` and syncDelay to 0 because no scripts are present.
 */
export default function CssPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
}: CssPreviewProps): VNode {
  return (
    <HtmlPreviewWrapper
      globalConfig={{ head: CSS_PREVIEW_HEAD }}
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
    />
  );
}
