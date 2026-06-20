/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <CssPreview> — applies the zfb Island around the
// real "use client" CssPreview component.
//
// Registered in pages/_mdx-components.ts as the `CssPreview` binding. The zfb
// MDX emitter resolves named-tag access through the page-side `components` prop
// (MDX-local `import CssPreview from '@/components/CssPreview'` statements in
// the corpus are stripped by the emitter and never reach the bundle), so this
// is the single binding that renders every <CssPreview> usage.
//
// ## Island wiring (mirrors _preset-generator.tsx — the canonical pattern)
//
// The page imports this file, this file imports the real "use client"
// component (src/components/css-preview/css-preview.tsx). The zfb scanner walks
// page → _mdx-components → here → CssPreview and registers CssPreview in the
// client manifest. `<Island when="visible">` emits
// `data-zfb-island="CssPreview"` at SSR; the runtime hydrates the real
// component in place when the preview scrolls into view (the iframe is heavy
// and off the critical path).

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import CssPreview, {
  type CssPreviewProps,
} from "@/components/css-preview/css-preview";

// Pin displayName so zfb's captureComponentName produces a stable marker even
// after the SSR pipeline runs through a function-name-rewriting layer. Matches
// the data-zfb-island attribute the runtime queries. Mirrors _preset-generator.
(CssPreview as { displayName?: string }).displayName = "CssPreview";

/**
 * Public MDX-registered binding (`CssPreview: CssPreviewWrapper`). Wraps the
 * real component in `<Island when="visible">` for deferred hydration.
 */
export function CssPreviewWrapper(props: CssPreviewProps): VNode {
  return Island({
    when: "visible",
    children: <CssPreview {...props} />,
  }) as unknown as VNode;
}
