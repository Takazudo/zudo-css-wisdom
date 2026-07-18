/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Interactive Tailwind demo — a thin wrapper over the package HtmlPreview.
//
// Injects the Tailwind Play CDN as an external script (zudo-doc 4.2.0's
// `externalScripts`) so utility classes compile in-browser, and skips the
// package preflight (`preflight={false}`) because the CDN ships its own reset.
// The package auto-derives the iframe sandbox (allow-scripts allow-same-origin)
// and the async measure delay from the presence of an external script.

import type { VNode } from "preact";
import { HtmlPreviewWrapper } from "@takazudo/zudo-doc/html-preview-wrapper";

export interface TailwindPreviewProps {
  /** HTML body content rendered inside the isolated iframe. */
  html: string;
  /** Optional extra CSS injected after the Tailwind CDN. */
  css?: string;
  /** Optional title shown in the preview title bar. */
  title?: string;
  /** Fixed iframe height in pixels. Auto-sizes when omitted. */
  height?: number;
  /** When true, the code panel is expanded by default. */
  defaultOpen?: boolean;
  /**
   * Tailwind Play CDN first-party plugins (e.g. "forms", "typography").
   * Appended as `?plugins=…` — the CDN's documented plugin-loading query param.
   */
  plugins?: string[];
}

export default function TailwindPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
  plugins,
}: TailwindPreviewProps): VNode {
  const cdn =
    "https://cdn.tailwindcss.com" +
    (plugins && plugins.length > 0 ? `?plugins=${plugins.join(",")}` : "");
  return (
    <HtmlPreviewWrapper
      html={html}
      css={css}
      title={title}
      height={height}
      defaultOpen={defaultOpen}
      externalScripts={[cdn]}
      preflight={false}
    />
  );
}

TailwindPreview.displayName = "TailwindPreview";
