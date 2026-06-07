/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR fallback shell for the <PresetGenerator> interactive form.
//
// The real component (src/components/preset-generator.tsx) is a large
// client-only island. This file is imported transitively from page modules
// (pages/docs/[...slug].tsx → _mdx-components.ts → here), so zfb's island
// scanner walks the static import chain and registers PresetGenerator in the
// manifest. Without this import, the scanner never finds the component and
// client-side hydration never fires (orphan-component problem; same root
// cause fixed for body-end islands in _body-end-islands.tsx).
//
// The fallback renders all 8 section headings as static SSR HTML so:
//   1. Screen readers and search engines see the section structure (a11y/SEO).
//   2. Layout does not collapse to nothing while JS loads (no-JS layout).
//   3. The scanner traces this file → preset-generator.tsx via the Island child
//      and registers PresetGenerator in the manifest for client-side mounting.
//
// Uses the canonical `<Island ssrFallback>` API (zfb) so the scanner can
// connect the import to the manifest entry and the hydration runtime can
// mount the real form into the skip-ssr placeholder on the client.

import type { VNode } from "preact";
import { HeadingH3 } from "@takazudo/zudo-doc/content";
import { Island } from "@takazudo/zfb";
import PresetGenerator from "@/components/preset-generator";

// Pin displayName so zfb's captureComponentName produces a stable marker
// name even after the SSR pipeline runs through a function-name-rewriting
// layer. Matches the data-zfb-island-skip-ssr attribute value the runtime
// queries. Mirrors the pattern in _body-end-islands.tsx.
(PresetGenerator as { displayName?: string }).displayName = "PresetGenerator";

// Heading text for each of the 8 sections — must match the original
// SectionHeading calls in src/components/preset-generator.tsx exactly
// so the SSR fallback and the real component render the same section labels.
// Order must mirror the JSX source order in preset-generator.tsx — do NOT
// sort alphabetically. The array drives the SSR fallback heading sequence
// shown to screen readers and visible before JS hydration.
const SECTION_HEADINGS = [
  "Project Name",
  "Default Language",
  "Color Scheme Mode",
  "Color Scheme",
  "Features",
  "Header right items",
  "Markdown Options",
  "Package Manager",
] as const;

/**
 * Static SSR fallback for the interactive PresetGenerator form.
 *
 * Renders all 8 section headings as static HTML for a11y/SEO and no-JS
 * layout stability. Uses Island with ssrFallback so the zfb scanner traces
 * this file → preset-generator.tsx and registers the real component in the
 * island manifest for client-side mounting.
 */
export function PresetGeneratorFallback(): VNode {
  const fallback = (
    <div class="zd-preset-gen-fallback">
      {SECTION_HEADINGS.map((heading) => (
        <section key={heading}>
          <HeadingH3>{heading}</HeadingH3>
        </section>
      ))}
    </div>
  );

  // Island with ssrFallback:
  // - SSR emits the section headings as static HTML inside the skip-ssr div.
  // - The scanner reads children.type = PresetGenerator → registers it in
  //   the manifest under "PresetGenerator".
  // - The hydration runtime mounts the real interactive form into the
  //   skip-ssr placeholder on the client after load.
  return Island({
    when: "load",
    ssrFallback: fallback,
    children: <PresetGenerator />,
  }) as unknown as VNode;
}
