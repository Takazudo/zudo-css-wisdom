"use client";

// Re-export stub for the DocHistory island.
//
// The real component now ships in the package at
// @takazudo/zudo-doc/doc-history (epic #2344, S4).
// pages/lib/_doc-history-area.tsx imports directly from there, so this
// file is only kept as a stable re-export in case any project-local code
// references the @/components/doc-history path.
export { DocHistory } from "@takazudo/zudo-doc/doc-history";
