/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Interactive CSS demo — a thin wrapper over the package HtmlPreview.
//
// zudo-doc 4.2.0's `fullHeight` prop supplies the `html,body{height:100%}` shim
// these demos rely on (a full-height canvas). Everything else — the preflight
// reset, dedent, viewport switcher, collapsible code panel, sandbox
// (allow-same-origin; no scripts) and auto-height — is owned by the package.

import type { VNode } from "preact";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";

export interface CssPreviewProps {
  /** HTML body content rendered inside the isolated iframe. */
  html: string;
  /** CSS applied to the iframe document (after the default preflight reset). */
  css: string;
  /** Optional title shown in the preview title bar. */
  title?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code panel is expanded by default. */
  defaultOpen?: boolean;
}

export default function CssPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
}: CssPreviewProps): VNode {
  return (
    <HtmlPreviewWrapper
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
      fullHeight
    />
  );
}

CssPreview.displayName = "CssPreview";
