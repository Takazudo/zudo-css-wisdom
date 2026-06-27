// z-index design tokens — single source of truth.
//
// This file is the ONE place z-index tiers are defined. The CSS `@theme` block
// in `src/styles/global.css` is GENERATED from this list by the
// `gen-z-index` bin from `@takazudo/zudo-doc` (run `pnpm gen:z-index`); never
// hand-edit the generated block. `pnpm check:z-index` re-runs the generator
// into a buffer and fails on drift, so the committed CSS can never silently
// diverge from this list.
//
// Strategy (from zudolab/zudo-css-wisdom z-index-strategy): semantic single-
// namespace tokens — names describe ROLES, never magnitudes. One flat ordered
// list. Values are deliberately gapped but otherwise arbitrary: renaming and
// reordering is cheap, which is the whole point. Tailwind v4 reads the
// `--z-index-<name>` theme key and generates a `z-<name>` utility, so e.g.
// `@theme { --z-index-toolbar: 20 }` produces `.z-toolbar { z-index: 20 }`.
//
// `kind` distinguishes:
//   - "global": a tier on the single global stacking scale (overlay chrome etc.)
//   - "local":  anonymous reusable helpers for promoting a child WITHIN a parent
//               stacking context (`isolation: isolate` / `position: relative`),
//               not a position on the global scale.
//
// Rationale for the two zudo-doc-specific additions (NOT in the generic
// overlay-centric strategy scale):
//   - `sidebar` — persistent layout chrome (desktop sidebar, TOC, sidebar-toggle
//     handle, resizer handle). The strategy's scale has no persistent-sidebar/TOC
//     tier. `toolbar` (the sticky header) is deliberately placed ABOVE `sidebar`
//     to preserve the existing header-wins ordering; they do not overlap
//     spatially, but the historical relationship is kept explicit.
//   - `drag` — transient drag affordance (sidebar-resizer ghost line). Replaces
//     the old `z-9999` anti-pattern with a named top-of-steady-UI tier.
//
// `popover`, `toast`, and `tooltip` are reserved canonical tiers from the
// strategy's scale — kept for completeness (and so downstream `create-zudo-doc`
// users inherit the full scale) even though zudo-doc does not use them yet.

export type ZIndexKind = "global" | "local";

export interface ZIndexTier {
  name: string;
  value: number;
  purpose: string;
  kind: ZIndexKind;
}

export const Z_INDEX_TIERS: ZIndexTier[] = [
  {
    name: "content",
    value: 0,
    purpose: "default in-flow content (implicit baseline)",
    kind: "global",
  },
  {
    name: "local-1",
    value: 1,
    purpose: "child promotion inside an isolated parent stacking context",
    kind: "local",
  },
  {
    name: "local-2",
    value: 2,
    purpose: "child promotion inside an isolated parent stacking context",
    kind: "local",
  },
  {
    name: "local-3",
    value: 3,
    purpose: "child promotion inside an isolated parent stacking context",
    kind: "local",
  },
  {
    name: "sidebar",
    value: 10,
    purpose:
      "persistent layout chrome: desktop sidebar, TOC, sidebar-toggle handle, resizer handle",
    kind: "global",
  },
  {
    name: "toolbar",
    value: 20,
    purpose: "sticky top header (sits above sidebar chrome)",
    kind: "global",
  },
  {
    name: "dropdown",
    value: 30,
    purpose: "header menus, version/language switchers",
    kind: "global",
  },
  {
    name: "popover",
    value: 40,
    purpose: "reserved — inline popovers (canonical scale; not yet used)",
    kind: "global",
  },
  {
    name: "modal-backdrop",
    value: 50,
    purpose: "mobile drawer backdrop, <dialog> ::backdrop",
    kind: "global",
  },
  {
    name: "modal",
    value: 60,
    purpose: "mobile sidebar drawer panel, search <dialog>",
    kind: "global",
  },
  {
    name: "toast",
    value: 70,
    purpose: "reserved — transient notifications (canonical scale; not yet used)",
    kind: "global",
  },
  {
    name: "tooltip",
    value: 80,
    purpose:
      "reserved — highest steady UI layer, below only the transient drag tier (canonical scale; not yet used)",
    kind: "global",
  },
  {
    name: "drag",
    value: 90,
    purpose:
      "transient drag affordance: sidebar-resizer ghost line (replaces the z-9999 anti-pattern)",
    kind: "global",
  },
];
