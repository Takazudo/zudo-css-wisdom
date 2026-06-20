/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// MathBlock — server-rendered KaTeX component for MDX math expressions.
//
// Registered in pages/_mdx-components.ts as `MathBlock` so the MDX corpus
// can reference it as <MathBlock latex="…" block />.
//
// Used by the math-equations.mdx content files (both EN and JA) which write
// `<MathBlock>` JSX directly instead of `$$…$$` fences. The explicit JSX
// form is required because the zfb Rust MDX→JSX emitter does not understand
// remark-math `$$…$$` syntax — LaTeX identifiers like `\infty` become invalid
// JSX expressions `{\infty}` that esbuild rejects (zudo-front-builder #93).
// Using `<MathBlock>` directly keeps the LaTeX inside a string attribute,
// which esbuild accepts cleanly.
//
// Rendering: katex.renderToString() is called at SSR time — no client JS.
// `throwOnError: false` keeps a broken formula visible as an error span
// rather than crashing the page.

import katex from "katex";
import type { VNode } from "preact";

interface MathBlockProps {
  /** Raw LaTeX source string. */
  latex: string;
  /** When true, renders as a block (display) equation; otherwise inline. */
  block?: boolean;
}

/**
 * Server-rendered KaTeX math component.
 *
 * Block mode wraps the output in `<div class="math math-display">`;
 * inline mode uses `<span class="math math-inline">`. The class names
 * match the standard rehype-katex output so existing CSS (e.g. the
 * KaTeX stylesheet) still applies.
 */
export function MathBlock({ latex, block = false }: MathBlockProps): VNode {
  const html = katex.renderToString(latex, {
    displayMode: block,
    // Never throw — malformed LaTeX renders a visible error span instead
    // of crashing the entire page build.
    throwOnError: false,
  });

  if (block) {
    return (
      <div
        class="math math-display"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      class="math math-inline"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
