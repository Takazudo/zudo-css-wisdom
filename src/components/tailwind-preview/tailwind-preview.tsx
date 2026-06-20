"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Interactive Tailwind CSS demo island — the hydration target for
// <TailwindPreview>.
//
// See css-preview.tsx for the island-wiring rationale. Differences here:
//   - the srcdoc injects the Tailwind Play CDN <script> (so utility classes
//     compile in-browser) instead of the preflight reset, and
//   - the sandbox is `allow-scripts allow-same-origin` because the CDN script
//     must run; `syncDelay` is non-zero so the auto-height measure happens
//     after the CDN finishes generating styles.

import type { VNode } from "preact";
import { useMemo } from "preact/hooks";
import { PreviewBase } from "@takazudo/zudo-doc/html-preview-wrapper";
import { dedent } from "@/utils/dedent";

export interface TailwindPreviewProps {
  /** HTML body content rendered inside the isolated iframe. */
  html: string;
  /** Optional extra CSS injected after the Tailwind CDN script. */
  css?: string;
  /** Optional title shown in the preview title bar. */
  title?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code panel is expanded by default. */
  defaultOpen?: boolean;
  /**
   * Tailwind Play CDN first-party plugins (e.g. "forms", "typography").
   * Appended as `?plugins=…` to the CDN URL — the CDN's documented
   * plugin-loading query param, not a custom convention.
   */
  plugins?: string[];
}

/**
 * Build the iframe `srcdoc`: the Tailwind Play CDN `<script>` (with optional
 * first-party plugins) plus any per-usage CSS, with the demo HTML in the body.
 */
function buildSrcdoc(html: string, css?: string, plugins?: string[]): string {
  const pluginQuery =
    plugins && plugins.length > 0 ? `?plugins=${plugins.join(",")}` : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com${pluginQuery}"></script>
${css ? `<style>${css}</style>` : ""}
</head>
<body>${html}</body>
</html>`;
}

export default function TailwindPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
  plugins,
}: TailwindPreviewProps): VNode {
  const srcdoc = useMemo(
    () => buildSrcdoc(html, css, plugins),
    [html, css, plugins],
  );

  return (
    <PreviewBase
      title={title}
      height={height}
      srcdoc={srcdoc}
      defaultOpen={defaultOpen}
      sandbox="allow-scripts allow-same-origin"
      // Tailwind CDN compiles styles asynchronously after load — wait before
      // measuring height so the reflowed content is captured.
      syncDelay={300}
      codeBlocks={[
        { language: "html", title: "HTML", code: dedent(html) },
        ...(css ? [{ language: "css", title: "CSS", code: dedent(css) }] : []),
      ]}
    />
  );
}

TailwindPreview.displayName = "TailwindPreview";
