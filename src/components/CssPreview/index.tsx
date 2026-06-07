"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { HtmlPreviewWrapperInner } from "@takazudo/zudo-doc/html-preview-wrapper";

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
 * Bare hydration target for the `<CssPreview>` island.
 *
 * Renders the package's BARE `HtmlPreviewWrapperInner` (which does NOT call
 * `Island()` itself), so the public `CssPreview` below provides exactly ONE
 * `Island()` boundary — no double-wrap, no #1925/#1355 reparenting. Its
 * `displayName` MUST equal the export name (the zfb island-marker contract),
 * and it MUST NOT render `<Island>` of its own.
 */
export function CssPreviewInner({
  html,
  css,
  title,
  height,
  defaultOpen,
}: CssPreviewProps): VNode {
  return (
    <HtmlPreviewWrapperInner
      globalConfig={{ head: CSS_PREVIEW_HEAD }}
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
    />
  );
}
CssPreviewInner.displayName = "CssPreviewInner";

/**
 * zcss `<CssPreview>` → a real zfb island.
 *
 * The `Island()` call lives HERE, in project source, so zfb's island scanner
 * discovers it and includes `CssPreviewInner` in the client island bundle.
 * Forwarding to the package's `HtmlPreviewWrapper` instead hides the
 * `Island()` call inside node_modules, which the scanner does NOT follow
 * through a plain forwarder shim — the preview then SSRs correctly but never
 * hydrates (dead viewport buttons / code panel). Caught by the S6 gate.
 *
 * Single wrap: this `Island()` wraps `CssPreviewInner`, which renders the
 * BARE `HtmlPreviewWrapperInner`. `css` is forwarded as the per-usage `css`
 * prop so it is injected as a `<style>` AND shown as the CSS code block;
 * sandbox resolves to `allow-same-origin`, syncDelay 0 (no scripts).
 */
export default function CssPreview(props: CssPreviewProps): VNode {
  return Island({
    when: "visible",
    children: <CssPreviewInner {...props} />,
  }) as VNode;
}
