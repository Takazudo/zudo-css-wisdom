/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <Details> — trivial passthrough to the v2
// Details component.
//
// The v2 Details component accepts standard Preact children. MDX passes slot
// content as `children`, so the mapping is direct. The title prop (default
// "Details") is forwarded unchanged.

import type { ComponentChildren, VNode } from "preact";
import { Details as DetailsV2 } from "@takazudo/zudo-doc/details";

export interface DetailsWrapperProps {
  /** Summary label shown in the <summary> element. Defaults to "Details". */
  title?: string;
  /** MDX slot content rendered inside the collapsed body. */
  children?: ComponentChildren;
}

/**
 * Passthrough wrapper for the v2 Details component.
 *
 * Used in pages/_mdx-components.ts as the Details binding so that MDX
 * content using `<Details title="...">...</Details>` renders correctly
 * on zfb routes.
 */
export function DetailsWrapper({ title, children }: DetailsWrapperProps): VNode {
  return <DetailsV2 title={title}>{children}</DetailsV2>;
}
