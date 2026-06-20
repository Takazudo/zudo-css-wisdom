/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared afterSidebar block for doc pages.
//
// Extracted from the four doc-route render bodies (pages/docs/[...slug].tsx,
// pages/[locale]/docs/[...slug].tsx, pages/v/[version]/docs/[...slug].tsx,
// pages/v/[version]/[locale]/docs/[...slug].tsx) where the block was
// duplicated verbatim across all four routes.
//
// Contains:
//   1. A pre-paint inline <script> that restores the persisted sidebar
//      visibility flag from localStorage before first paint (avoids flash).
//   2. A `DesktopSidebarToggle` Island that mounts on "load".
//
// Pattern mirrors `_body-end-islands.tsx`: the file imports the real
// component so zfb's island scanner walks page → helper → DesktopSidebarToggle
// and registers the constructor in the manifest. The Island call's return type
// is widened to `unknown` (JSX shim gap) so call-sites cast through
// `as unknown as VNode` at the boundary.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import DesktopSidebarToggle from "@/components/desktop-sidebar-toggle";

/**
 * The `afterSidebar` slot content shared by all four doc-route page components.
 *
 * Returns the pre-paint localStorage script + `DesktopSidebarToggle` Island
 * when `settings.sidebarToggle` is enabled; returns `undefined` when it is
 * disabled (matching the conditional the route files used inline).
 */
export function SidebarPrepaint(): JSX.Element | undefined {
  if (!settings.sidebarToggle) return undefined;

  return (
    <>
      {/* Pre-paint inline script: restore persisted sidebar visibility to
          <html data-sidebar-hidden> before first paint to avoid flash.
          Runs unconditionally when sidebarToggle is enabled; the attribute
          is only set when localStorage says "false" so the default (visible)
          needs no attribute and causes no layout shift. */}
      <script dangerouslySetInnerHTML={{
        __html: `(function(){try{if(localStorage.getItem('zudo-doc-sidebar-visible')==='false'){document.documentElement.setAttribute('data-sidebar-hidden','');}}catch(e){}})();`,
      }} />
      {Island({
        when: "load",
        children: <DesktopSidebarToggle />,
      }) as unknown as VNode}
    </>
  );
}
