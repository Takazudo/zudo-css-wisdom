// Re-export stub for DocHistory types.
//
// DocHistoryData and DocHistoryEntry now ship from the package at
// @takazudo/zudo-doc/island-types (epic #2344, S1a).
// This file is kept as a stable re-export in case any project-local code
// references the @/types/doc-history path.
export type { DocHistoryData, DocHistoryEntry } from "@takazudo/zudo-doc/island-types";
