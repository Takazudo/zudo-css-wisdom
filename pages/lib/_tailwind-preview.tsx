/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <TailwindPreview> — applies the zfb Island around
// the real "use client" TailwindPreview component.
//
// See _css-preview.tsx for the full island-wiring rationale. Registered in
// pages/_mdx-components.ts as the `TailwindPreview` binding.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import TailwindPreview, {
  type TailwindPreviewProps,
} from "@/components/tailwind-preview/tailwind-preview";

// Pin displayName so zfb's captureComponentName produces a stable marker.
(TailwindPreview as { displayName?: string }).displayName = "TailwindPreview";

/**
 * Public MDX-registered binding (`TailwindPreview: TailwindPreviewWrapper`).
 * Wraps the real component in `<Island when="visible">`.
 */
export function TailwindPreviewWrapper(props: TailwindPreviewProps): VNode {
  return Island({
    when: "visible",
    children: <TailwindPreview {...props} />,
  }) as unknown as VNode;
}
