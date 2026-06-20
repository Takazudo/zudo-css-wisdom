/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Real Preact bindings for the admonition MDX tags (Note/Tip/Info/Warning/
// Danger/Caution/Important). Replaces the former literal-VNode
// `makeAdmonitionStub` in pages/_mdx-components.ts with a proper typed
// component — restoring the first-class admonition components the Astro-era
// theme shipped (zudolab/zudo-doc#1456), now on the zfb pipeline.
//
// These tags arrive from two zfb features: the `directives` map emits them from
// `:::note` directives, and `githubAlerts` emits Important/Caution from
// `[!IMPORTANT]`/`[!CAUTION]` blockquotes. The JSX form `<Note title="…">` is
// also authored directly in MDX. All three paths render through here.
//
// Markup contract — KEEP STABLE. The structure below
//   <div data-admonition="<variant>" class="admonition admonition-<variant>">
//     <p class="admonition-title">…</p>
//     <div class="admonition-body">…</div>
//   </div>
// is the hook both the design-system CSS (`.admonition-<variant>` rules in
// src/styles/global.css) and the e2e smoke spec (e2e/smoke-admonitions.spec.ts)
// target. The per-variant color + icon live in CSS keyed off `data-admonition`,
// so this component stays presentation-agnostic.
import type { ComponentChildren, VNode } from "preact";

export type AdmonitionVariant =
  | "note"
  | "tip"
  | "info"
  | "warning"
  | "danger"
  | "caution"
  | "important";

export interface AdmonitionProps {
  /** Custom title; falls back to the capitalized variant name (e.g. "Note"). */
  title?: string;
  children?: ComponentChildren;
}

/**
 * Build the admonition component for a single variant. The title row is always
 * rendered — defaulting to the capitalized variant name when the author gives
 * no `title` — matching the Astro reference where every callout shows a title.
 */
export function makeAdmonition(variant: AdmonitionVariant) {
  const defaultTitle = variant.charAt(0).toUpperCase() + variant.slice(1);
  return function Admonition({ title, children }: AdmonitionProps): VNode {
    const heading = title && title.length > 0 ? title : defaultTitle;
    return (
      <div data-admonition={variant} class={`admonition admonition-${variant}`}>
        <p class="admonition-title">{heading}</p>
        <div class="admonition-body">{children}</div>
      </div>
    );
  };
}
