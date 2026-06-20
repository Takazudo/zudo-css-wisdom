"use client";

// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app (configured
// project-wide). Same pattern as src/components/sidebar-tree.tsx and
// packages/zudo-doc/src/theme-toggle/index.tsx. Type references via
// the global React namespace still resolve via @types/react.
import { useState, useEffect } from "preact/hooks";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// pull lifecycle event names from the v2 transitions module rather
// than hard-coding `astro:*` literals.
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import SidebarTree from "@/components/sidebar-tree";
import type { NavNode } from "@/utils/docs";
import type { LocaleLink } from "@/types/locale";
// Types-only subpath (`./sidebar/types`) sidesteps the JSX type-graph
// pulled in by `./sidebar`'s runtime barrel.
import type { SidebarRootMenuItem } from "@takazudo/zudo-doc/sidebar/types";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

// Mobile drawer hosts the SidebarTree directly (rather than receiving it as
// JSX children) so the tree's data props ride across the SSR → hydrate
// boundary inside the Island marker's `data-props` attribute. zfb's
// `Island()` only serialises a child component's *own* props (excluding
// `children`); when SidebarTree was passed as `children`, its data was
// dropped during hydration and Preact wiped the SSR-rendered tree DOM.
// Mirroring the desktop `<Sidebar treeComponent={SidebarTree} ...>` shape
// keeps the data attached to the wrapping island. zudolab/zudo-doc#1355
// wave 13.5.

interface SidebarToggleProps {
  nodes: NavNode[];
  currentSlug?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  localeLinks?: LocaleLink[];
  themeDefaultMode?: "light" | "dark";
}

export default function SidebarToggle({
  nodes,
  currentSlug,
  rootMenuItems,
  backToMenuLabel,
  localeLinks,
  themeDefaultMode,
}: SidebarToggleProps) {
  // Initial state must match SSR (`open=false`) so the hydration DOM
  // matches the SSG output byte-for-byte. The backdrop and toggle-icon
  // are rendered unconditionally below so the hydration tree has the
  // same shape regardless of `open`, preventing Preact from re-mounting
  // the subtree (which can drop click handlers on the hamburger button).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close mobile sidebar on View Transition navigation
  useEffect(() => {
    function handleSwap() {
      setOpen(false);
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleSwap);
  }, []);

  return (
    <>
      {/* Hamburger button - visible only on mobile.
          Both icons are always rendered so the SSR output has the same
          DOM shape as the post-hydration tree. The closed-state icon is
          hidden via `hidden` when open=true, and vice versa, so Preact's
          hydration walk sees byte-stable markup and keeps the click
          handler attached. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="lg:hidden px-hsp-sm py-vsp-xs -ml-hsp-sm mr-hsp-sm text-muted hover:text-fg"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
        aria-expanded={open}
      >
        {/* X icon — visible only when open */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cx("h-icon-lg w-icon-lg", !open && "hidden")}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        {/* Hamburger icon — visible only when closed */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cx("h-icon-lg w-icon-lg", open && "hidden")}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Backdrop overlay - mobile only.
          Rendered unconditionally; CSS `hidden` toggles visibility so
          the SSR DOM tree matches the hydrated tree (no subtree
          mount/unmount across the hydration boundary).
          `z-modal-backdrop` (50) intentionally sits ABOVE the header
          (`z-toolbar`, 20): the open mobile drawer is a modal surface that
          dims the whole viewport, header included. Closing is via tapping the
          backdrop (onClick below), so the header hamburger being dimmed under
          it is fine. */}
      <div
        className={cx("fixed inset-0 z-modal-backdrop bg-overlay/30 lg:hidden", !open && "hidden")}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar panel - mobile only (desktop sidebar is in doc-layout).
          `inert` when closed: the panel is only visually hidden via
          `-translate-x-full`, so without `inert` its links/filter/buttons
          stay in the tab order and accessibility tree while off-screen
          (zudolab/zudo-doc#2059). `inert={false}` serialises to no attribute,
          so the SSR (open=false → `inert`) and initial client render stay
          byte-stable for hydration. */}
      <aside
        inert={!open}
        className={`
          fixed top-[3.5rem] left-0 z-modal h-[calc(100vh-3.5rem)] w-[16rem] flex flex-col
          border-r border-muted bg-bg transition-transform duration-200
          lg:hidden
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex-1 overflow-y-auto">
          <SidebarTree
            nodes={nodes}
            currentSlug={currentSlug}
            rootMenuItems={rootMenuItems}
            backToMenuLabel={backToMenuLabel}
            localeLinks={localeLinks}
            themeDefaultMode={themeDefaultMode}
          />
        </div>
      </aside>
    </>
  );
}
