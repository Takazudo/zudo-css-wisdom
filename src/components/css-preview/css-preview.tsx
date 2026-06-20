"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Interactive CSS demo island — the hydration target for <CssPreview>.
//
// Ported from the Astro/React original to a Preact "use client" island so the
// zfb scanner registers it in the client manifest. The host-side wrapper in
// pages/lib/_css-preview.tsx applies `<Island when="visible">` around this
// component; the scanner walks page → _mdx-components → _css-preview → here
// and binds the `data-zfb-island="CssPreview"` marker to this constructor.
//
// Reuses the framework PreviewBase (iframe viewport switcher + collapsible
// code panel) from @takazudo/zudo-doc — only the srcdoc/codeBlocks
// construction is CssPreview-specific.

import type { VNode } from "preact";
import { useMemo } from "preact/hooks";
import { PreviewBase } from "@takazudo/zudo-doc/html-preview-wrapper";
import { dedent } from "@/utils/dedent";
import { preflightCss } from "../html-preview/preflight";

export interface CssPreviewProps {
  /** HTML body content rendered inside the isolated iframe. */
  html: string;
  /** CSS applied to the iframe document (after the preflight reset). */
  css: string;
  /** Optional title shown in the preview title bar. */
  title?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code panel is expanded by default. */
  defaultOpen?: boolean;
}

/**
 * Build the iframe `srcdoc`: Tailwind v4 preflight reset + a full-height shim
 * + the demo's own CSS, with the demo HTML in the body. The preflight makes
 * the iframe a neutral, reset canvas independent of the host site CSS.
 */
function buildSrcdoc(html: string, css: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${preflightCss}</style>
<style>html, body { height: 100%; }</style>
<style>${css}</style>
</head>
<body>${html}</body>
</html>`;
}

export default function CssPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
}: CssPreviewProps): VNode {
  const srcdoc = useMemo(() => buildSrcdoc(html, css), [html, css]);

  return (
    <PreviewBase
      title={title}
      height={height}
      srcdoc={srcdoc}
      defaultOpen={defaultOpen}
      // CSS demos never run scripts — allow-same-origin alone lets the parent
      // read iframe.contentDocument for auto-height. No allow-scripts.
      sandbox="allow-same-origin"
      syncDelay={0}
      codeBlocks={[
        { language: "html", title: "HTML", code: dedent(html) },
        { language: "css", title: "CSS", code: dedent(css) },
      ]}
    />
  );
}

CssPreview.displayName = "CssPreview";
