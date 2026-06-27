// Thin stub — types moved to the package (epic #2344, S6).
// Re-exports the shared discriminated-union props types for all 4 doc-route
// pages from @takazudo/zudo-doc/doc-page-props.
//
// S5 and downstream (S7) consumers import `DocPageBaseProps`, `DocPageEntry`,
// `AutoIndexNode`, `DocPageEntryProps`, `DocPageAutoIndexProps` from this path
// unchanged — all are re-exported below.

export type {
  DocNavNode,
  DocPageEntry,
  DocPageFrontmatter,
  AutoIndexNode,
  DocPageEntryProps,
  DocPageAutoIndexProps,
  DocPageBaseProps,
  HeadingItem,
} from "@takazudo/zudo-doc/doc-page-props";

// Backward-compatible alias: downstream callers that import `NavNode` from
// this path (e.g. _doc-route-entries.ts, route-enumerators.ts) continue to
// resolve. `DocNavNode` is structurally identical to the host's `NavNode` from
// src/utils/docs.ts (same required fields, same optional fields).
export type { DocNavNode as NavNode } from "@takazudo/zudo-doc/doc-page-props";

// Backward-compatible alias: `BreadcrumbItem` was previously imported from
// @/utils/docs in some files. The package's `DocPageBaseProps` uses
// `BreadcrumbItem` from @takazudo/zudo-doc/breadcrumb/types — re-export it
// here so callers importing from this path still resolve.
export type { BreadcrumbItem } from "@takazudo/zudo-doc/breadcrumb";
